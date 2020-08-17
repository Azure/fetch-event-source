import * as parse from './parse';

describe('parse', () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    describe('getLines', () => {
        it('single line', async () => {
            // arrange:
            async function* getBytes() {
                yield encoder.encode('id: abc\n');
            }

            // act:
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                // assert:
                expect(decoder.decode(line)).toEqual('id: abc');
                expect(fieldLength).toEqual(2);
            }
        });

        it('multiple lines', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('id: abc\n');
                yield encoder.encode('data: def\n');
            }

            // act
            let lineNum = 0;
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                ++lineNum;

                // assert:
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            }
        });

        it('single line split across multiple arrays', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('id: a');
                yield encoder.encode('bc\n');
            }

            // act
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                // assert:
                expect(decoder.decode(line)).toEqual('id: abc');
                expect(fieldLength).toEqual(2);
            }
        });

        it('multiple lines split across multiple arrays', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('id: abc\n');
                yield encoder.encode('da');
                yield encoder.encode('ta: def\n');
            }

            // act
            let lineNum = 0;
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                ++lineNum;

                // assert:
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            }
        });

        it('new line', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('\n');
            }

            // act
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                // assert:
                expect(decoder.decode(line)).toEqual('');
                expect(fieldLength).toEqual(-1);
            }
        });

        it('comment line', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode(': this is a comment\n');
            }

            // act
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                // assert:
                expect(decoder.decode(line)).toEqual(': this is a comment');
                expect(fieldLength).toEqual(0);
            }
        });

        it('line with no field', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('this is an invalid line\n');
            }

            // act
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                // assert:
                expect(decoder.decode(line)).toEqual('this is an invalid line');
                expect(fieldLength).toEqual(-1);
            }
        });

        it('single byte array with multiple lines separated by \\n', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('id: abc\ndata: def\n');
            }

            // act
            let lineNum = 0;
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                ++lineNum;

                // assert:
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            }
        });

        it('single byte array with multiple lines separated by \\r', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('id: abc\rdata: def\r');
            }

            // act
            let lineNum = 0;
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                ++lineNum;

                // assert:
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            }
        });

        it('single byte array with multiple lines separated by \\r\\n', async () => {
            // arrange
            async function* getBytes() {
                yield encoder.encode('id: abc\r\ndata: def\r\n');
            }

            // act
            let lineNum = 0;
            for await (const { line, fieldLength } of parse.getLines(getBytes())) {
                ++lineNum;

                // assert:
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            }
        });
    });

    describe('getMessages', () => {
        it('happy path', async () => {
            // arrange:
            async function* getLines() {
                yield { line: encoder.encode('retry: 42'), fieldLength: 5 };
                yield { line: encoder.encode('id: abc'), fieldLength: 2 };
                yield { line: encoder.encode('event:def'), fieldLength: 5 };
                yield { line: encoder.encode('data:ghi'), fieldLength: 4 };
                yield { line: encoder.encode(''), fieldLength: -1 };
            }

            // act:
            for await (const msg of parse.getMessages(getLines())) {
                // assert:
                expect(msg).toEqual({
                    retry: 42,
                    id: 'abc',
                    event: 'def',
                    data: 'ghi'
                });
            }
        });

        it('skip unknown fields', async () => {
            // arrange:
            async function* getLines() {
                yield { line: encoder.encode('id: abc'), fieldLength: 2 };
                yield { line: encoder.encode('foo: null'), fieldLength: 3 };
                yield { line: encoder.encode(''), fieldLength: -1 };
            }

            // act:
            for await (const msg of parse.getMessages(getLines())) {
                // assert:
                expect(msg).toEqual({ id: 'abc' });
            }
        });
        
        it('ignore non-integer retry', async () => {
            // arrange:
            async function* getLines() {
                yield { line: encoder.encode('id: abc'), fieldLength: 2 };
                yield { line: encoder.encode('retry: def'), fieldLength: 5 };
                yield { line: encoder.encode(''), fieldLength: -1 };
            }

            // act:
            for await (const msg of parse.getMessages(getLines())) {
                // assert:
                expect(msg).toEqual({ id: 'abc' });
            }
        });

        it('skip comment-only messages', async () => {
            // arrange:
            async function* getBytes() {
                yield encoder.encode('id:123\n\n');
                yield encoder.encode(':\n');
                yield encoder.encode(':\r\n');
                yield encoder.encode('event: foo \n\n');
            }

            // act:
            let msgNum = 0;
            for await (const msg of parse.getMessages(parse.getLines(getBytes()))) {
                ++msgNum;

                // assert:
                expect(msg).toEqual(msgNum === 1 ? { id: '123' } : { event: 'foo ' });
            }
        });
    });
});
