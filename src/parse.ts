/**
 * Represents a message sent in an event stream
 * https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format
 */
export interface EventSourceMessage {
    /** The event ID to set the EventSource object's last event ID value. */
    id?: string;
    /** A string identifying the type of event described. */
    event?: string;
    /** The event data */
    data?: string;
    /** The reconnection interval (in milliseconds) to wait before retrying the connection */
    retry?: number;
}

/**
 * Parses a byte stream into EventSourceMessages
 * @param stream {ReadableStream<Uint8Array>} a byte stream
 */
export function parseStream(stream: ReadableStream<Uint8Array>) {
    return getMessages(getLines(getBytes(stream)));
}

/** Returns an iterable of Uint8Arrays from an EventSource byte stream */
async function* getBytes(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    let result: ReadableStreamReadResult<Uint8Array>;
    while (!(result = await reader.read()).done) {
        yield result.value;
    }
}

const enum ControlChars {
    NewLine = 10,
    CarriageReturn = 13,
    Space = 32,
    Colon = 58,
}

/** 
 * Returns an iterable of EventSource line buffers from the incoming byte arrays. 
 * Each line should be of the format "field: value" and ends with \r, \n, or \r\n. 
 */
export async function* getLines(iter: AsyncIterableIterator<Uint8Array>) {
    let buffer: Uint8Array | undefined;
    let position: number; // current read position
    let fieldLength: number; // length of the `field` portion of the line
    let discardTrailingNewline = false;

    for await (const arr of iter) {
        if (buffer) {
            // we're still parsing the old line. Append the new bytes into buffer:
            buffer = concat(buffer, arr);
        } else {
            buffer = arr;
            position = 0;
            fieldLength = -1;
        }

        const bufLength = buffer.length;
        let lineStart = 0; // index where the current line starts
        while (position < bufLength) {
            if (discardTrailingNewline) {
                if (buffer[position] === ControlChars.NewLine) {
                    lineStart = ++position; // skip to next char
                }
                
                discardTrailingNewline = false;
            }
            
            // start looking forward till the end of line:
            let lineEnd = -1; // index of the \r or \n char
            for (; position < bufLength && lineEnd === -1; ++position) {
                switch (buffer[position]) {
                    case ControlChars.Colon:
                        if (fieldLength === -1) { // first colon in line
                            fieldLength = position - lineStart;
                        }
                        break;
                    // @ts-ignore:7029 \r case below should fallthrough to \n:
                    case ControlChars.CarriageReturn:
                        discardTrailingNewline = true;
                    case ControlChars.NewLine:
                        lineEnd = position;
                        break;
                }
            }

            if (lineEnd === -1) {
                // We reached the end of the buffer but the line hasn't ended.
                // Wait for the next arr and then continue parsing:
                break;
            }

            yield {
                line: buffer.subarray(lineStart, lineEnd),
                fieldLength,
            };

            lineStart = position; // we're now on the next line
            fieldLength = -1;
        }

        if (lineStart === bufLength) {
            buffer = undefined; // we've finished reading it
        } else if (lineStart) {
            // Create a new view into buffer beginning at lineStart so we don't
            // need to copy over the previous lines when we get the new arr:
            buffer = buffer.subarray(lineStart);
            position -= lineStart;
        }
    }
}

/** Returns an iterable of EventSourceMessages from the incoming line buffers */
export async function* getMessages(iter: AsyncIterableIterator<{ line: Uint8Array; fieldLength: number }>) {
    let message: EventSourceMessage = {};
    const decoder = new TextDecoder();
    for await (const { line, fieldLength } of iter) {
        if (!line.length) {
            // empty line denotes end of message. Yield our current message if it's not empty:
            for (const _ in message) {
                yield message;
                message = {}; // start a new message
                break;
            }
        } else if (fieldLength > 0) { // exclude comments and lines with no values
            // line is of format "<field>:<value>" or "<field>: <value>"
            const field = decoder.decode(line.subarray(0, fieldLength));
            let isNumber = false;
            switch (field) {
                // @ts-ignore:7029 retry case should fallthough to decode step:
                case 'retry':
                    isNumber = true;
                case 'data':
                case 'event':
                case 'id': {
                    const valueOffset = fieldLength + (line[fieldLength + 1] === ControlChars.Space ? 2 : 1);
                    let value: any = decoder.decode(line.subarray(valueOffset));
                    if (isNumber) {
                        value = parseInt(value, 10);
                        if (isNaN(value)) {
                            break; // per spec, ignore non-integers
                        }
                    }

                    message[field] = value as never;
                    break;
                }
            }
        }
    }
}

function concat(a: Uint8Array, b: Uint8Array) {
    const res = new Uint8Array(a.length + b.length);
    res.set(a);
    res.set(b, a.length);
    return res;
}
