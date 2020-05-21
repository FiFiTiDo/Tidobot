import Dictionary, { FileDictionaryParser, getPathSegments, normalizeSegment } from "../../../src/Utilities/Structures/Dictionary";
import * as chai from 'chai'
const should = chai.should();

describe("Dot notation", function() {
    it("should normalize segments properly", function() {
        normalizeSegment("0").should.equal(0);
        normalizeSegment("hello").should.equal("hello");
    });
    
    it("should parse keys properly", function() {
        getPathSegments("hello.world.test").should.deep.equal(["hello", "world", "test"]);
        getPathSegments(".hello.world.test").should.deep.equal([".hello", "world", "test"]);
        getPathSegments("hello.world.test.").should.deep.equal(["hello", "world", "test"]);
        getPathSegments("hello.0.test").should.deep.equal(["hello", 0, "test"]);
        getPathSegments("hello.5.test").should.deep.equal(["hello", 5, "test"]);
        getPathSegments("hello").should.deep.equal(["hello"]);
        getPathSegments("hello\\.test.what").should.deep.equal(["hello.test", "what"]);
    });
})

describe("Dictionary", function() {
    describe("#put", function() {
        it("should put values with simple keys", function() {
            let dict = new Dictionary();
            dict.put("hello", 1);
            dict.put("world", 2);
            dict.put("foo", "bar");
        
            dict.all().should.deep.equal({
                hello: 1,
                world: 2,
                foo: "bar"
            });
        });

        it("should put values with complex keys", function() {
            let dict = new Dictionary();
            dict.put("hello.world.foo", "bar");
            dict.put("new.key", "value");
            dict.put("hello.meaningOfLife", 42);
        
            dict.all().should.deep.equal({
                hello: {
                    world: {
                        foo: "bar"
                    },
                    meaningOfLife: 42
                },
                new: {
                    key: "value"
                }
            });
        })
    });

    describe("#get", function() {
        let dict = new Dictionary({
            hello: 1,
            world: 2,
            foo: "bar",
            complicated: {
                dot: "notation",
                array: [
                    1, "foo", 42, "hello world", {
                        it: "works"
                    }
                ],
                foo: "bar"
            },
            extra: {
                object: "test"
            }
        });

        it("should get values with simple keys", function() {
            dict.getOrDefault("hello").should.equal(1);
            dict.getOrDefault("world").should.equal(2);
            dict.getOrDefault("foo").should.equal("bar");
            should.equal(dict.getOrDefault("non-existant"), null);
            dict.getOrDefault("extra").should.deep.equal({ object: "test" });
        });

        it("should get values with default values", function() {
            dict.getOrDefault("hello", "nope").should.equal(1);
            dict.getOrDefault("world", "nada").should.equal(2);
            dict.getOrDefault("foo", "not going to happen").should.equal("bar");
            dict.getOrDefault("non-existant", "yep").should.equal("yep");
        });

        it("should get values with complex keys", function() {
            dict.getOrDefault("complicated.array.4.it").should.equal("works");
            dict.getOrDefault("complicated.array.5", "nope").should.equal("nope");
            dict.getOrDefault("complicated.array.2", "hello").should.equal(42);
            dict.getOrDefault("complicated.foo").should.equal("bar");
            should.equal(dict.getOrDefault("not.a.key"), null);
        });
    });

    describe("#remove", function() {
        let dict = new Dictionary({
            hello: 1,
            world: 2,
            foo: "bar",
            complicated: {
                dot: "notation",
                array: [
                    1, "foo", 42, "hello world", {
                        it: "works"
                    }
                ],
                foo: "bar"
            },
            extra: {
                object: "test"
            }
        });

        it("should remove values with simple keys", function() {
            dict.remove("hello");
            dict.remove("world");
            dict.remove("foo");
            dict.remove("extra");

            should.equal(dict.getOrDefault("hello"), null);
            should.equal(dict.getOrDefault("world"), null);
            should.equal(dict.getOrDefault("foo"), null);
            should.equal(dict.getOrDefault("extra"), null)
        });

        it("should remove values with complex keys", function() {
            dict.remove("complicated.array.4.it");
            dict.remove("complicated.array.5");
            dict.remove("complicated.array.2");
            dict.remove("complicated.foo");

            should.equal(dict.getOrDefault("complicated.array.4.it"), null);
            should.equal(dict.getOrDefault("complicated.array.5"), null);
            should.equal(dict.getOrDefault("complicated.array.2"), null);
            should.equal(dict.getOrDefault("complicated.foo"), null);
        });
    });

    describe("#keyOf", function() {
        it("should find the key of a given value", function() {
            let dict = new Dictionary({
                hello: 1,
                world: 2,
                foo: "bar"
            });
        
            dict.keyOf(1).should.equal("hello");
            dict.keyOf(2).should.equal("world");
            dict.keyOf("bar").should.equal("foo");
        })
    });
});