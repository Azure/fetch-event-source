import * as parse from './parse.js';

describe('parse', () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    describe('getLines', () => {
        it('single line', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual('id: abc');
                expect(fieldLength).toEqual(2);
            });

            // act:
            next(encoder.encode('id: abc\n'));
            
            // assert:
            expect(lineNum).toBe(1);
        });

        it('multiple lines', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            });
            
            // act:
            next(encoder.encode('id: abc\n'));
            next(encoder.encode('data: def\n'));
            
            // assert:
            expect(lineNum).toBe(2);
        });

        it('single line split across multiple arrays', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual('id: abc');
                expect(fieldLength).toEqual(2);
            });

            // act:
            next(encoder.encode('id: a'));
            next(encoder.encode('bc\n'));
            
            // assert:
            expect(lineNum).toBe(1);
        });

        it('multiple lines split across multiple arrays', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            });
            
            // act:
            next(encoder.encode('id: ab'));
            next(encoder.encode('c\nda'));
            next(encoder.encode('ta: def\n'));
            
            // assert:
            expect(lineNum).toBe(2);
        });

        it('new line', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual('');
                expect(fieldLength).toEqual(-1);
            });

            // act:
            next(encoder.encode('\n'));
            
            // assert:
            expect(lineNum).toBe(1);
        });

        it('comment line', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual(': this is a comment');
                expect(fieldLength).toEqual(0);
            });

            // act:
            next(encoder.encode(': this is a comment\n'));
            
            // assert:
            expect(lineNum).toBe(1);
        });

        it('line with no field', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual('this is an invalid line');
                expect(fieldLength).toEqual(-1);
            });

            // act:
            next(encoder.encode('this is an invalid line\n'));
            
            // assert:
            expect(lineNum).toBe(1);
        });

        it('line with multiple colons', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual('id: abc: def');
                expect(fieldLength).toEqual(2);
            });

            // act:
            next(encoder.encode('id: abc: def\n'));
            
            // assert:
            expect(lineNum).toBe(1);
        });

        it('single byte array with multiple lines separated by \\n', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            });

            // act:
            next(encoder.encode('id: abc\ndata: def\n'));
            
            // assert:
            expect(lineNum).toBe(2);
        });

        it('single byte array with multiple lines separated by \\r', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            });

            // act:
            next(encoder.encode('id: abc\rdata: def\r'));
            
            // assert:
            expect(lineNum).toBe(2);
        });

        it('single byte array with multiple lines separated by \\r\\n', () => {
            // arrange:
            let lineNum = 0;
            const next = parse.getLines((line, fieldLength) => {
                ++lineNum;
                expect(decoder.decode(line)).toEqual(lineNum === 1 ? 'id: abc' : 'data: def');
                expect(fieldLength).toEqual(lineNum === 1 ? 2 : 4);
            });

            // act:
            next(encoder.encode('id: abc\r\ndata: def\r\n'));
            
            // assert:
            expect(lineNum).toBe(2);
        });
    });

    describe('getMessages', () => {
        it('happy path', () => {
            // arrange:
            let msgNum = 0;
            const next = parse.getMessages(msg => {
                ++msgNum;
                expect(msg).toEqual({
                    retry: 42,
                    id: 'abc',
                    event: 'def',
                    data: 'ghi'
                });
            }, id => {
                expect(id).toEqual('abc');
            }, retry => {
                expect(retry).toEqual(42);
            });

            // act:
            next(encoder.encode('retry: 42'), 5);
            next(encoder.encode('id: abc'), 2);
            next(encoder.encode('event:def'), 5);
            next(encoder.encode('data:ghi'), 4);
            next(encoder.encode(''), -1);

            // assert:
            expect(msgNum).toBe(1);
        });

        it('skip unknown fields', () => {
            let msgNum = 0;
            const next = parse.getMessages(msg => {
                ++msgNum;
                expect(msg).toEqual({
                    id: 'abc',
                    data: '',
                    event: '',
                    retry: undefined,
                });
            }, id => {
                expect(id).toEqual('abc');
            }, _retry => {
                fail('retry should not be called');
            });

            // act:
            next(encoder.encode('id: abc'), 2);
            next(encoder.encode('foo: null'), 3);
            next(encoder.encode(''), -1);

            // assert:
            expect(msgNum).toBe(1);
        });
        
        it('ignore non-integer retry', () => {
            let msgNum = 0;
            const next = parse.getMessages(msg => {
                ++msgNum;
                expect(msg).toEqual({
                    id: '',
                    data: '',
                    event: '',
                    retry: undefined,
                });
            }, _id => {
                fail('id should not be called');
            }, _retry => {
                fail('retry should not be called');
            });

            // act:
            next(encoder.encode('retry: def'), 5);
            next(encoder.encode(''), -1);

            // assert:
            expect(msgNum).toBe(1);
        });

        it('skip comment-only messages', () => {
            // arrange:
            let msgNum = 0;
            const next = parse.getMessages(msg => {
                ++msgNum;
                expect(msg).toEqual({
                    retry: undefined,
                    id: '123',
                    event: 'foo ',
                    data: '',
                });
            }, id => {
                expect(id).toEqual('123');
            }, _retry => {
                fail('retry should not be called');
            });

            // act:
            next(encoder.encode('id:123'), 2);
            next(encoder.encode(':'), 0);
            next(encoder.encode(':    '), 0);
            next(encoder.encode('event: foo '), 5);
            next(encoder.encode(''), -1);

            // assert:
            expect(msgNum).toBe(1);
        });

        it('should append data split across multiple lines', () => {
            // arrange:
            let msgNum = 0;
            const next = parse.getMessages(msg => {
                ++msgNum;
                expect(msg).toEqual({
                    data: 'YHOO\n+2\n\n10',
                    id: '',
                    event: '',
                    retry: undefined,
                });
            }, _id => {
                fail('id should not be called');
            }, _retry => {
                fail('retry should not be called');
            });

            // act:
            next(encoder.encode('data:YHOO'), 4);
            next(encoder.encode('data: +2'), 4);
            next(encoder.encode('data'), 4);
            next(encoder.encode('data: 10'), 4);
            next(encoder.encode(''), -1);

            // assert:
            expect(msgNum).toBe(1);
        });

        it('should reset id if sent multiple times', () => {
            // arrange:
            const expectedIds = ['foo', ''];
            let idsIdx = 0;
            let msgNum = 0;
            const next = parse.getMessages(msg => {
                ++msgNum;
                expect(msg).toEqual({
                    data: '',
                    id: '',
                    event: '',
                    retry: undefined,
                });
            }, id => {
                expect(id).toEqual(expectedIds[idsIdx]);
                ++idsIdx;
            }, _retry => {
                fail('retry should not be called');
            });

            // act:
            next(encoder.encode('id: foo'), 2);
            next(encoder.encode('id'), 2);
            next(encoder.encode(''), -1);

            // assert:
            expect(idsIdx).toBe(2);
            expect(msgNum).toBe(1);
        });
    });
});
