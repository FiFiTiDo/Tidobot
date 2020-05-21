import "reflect-metadata"
import Dispatcher from "../../../src/Systems/Event/Dispatcher";
import Event from "../../../src/Systems/Event/Event";
import chai = require("chai");
import sinon = require("sinon");
import sinonChai = require("sinon-chai");

chai.should();
chai.use(sinonChai);

class TestEvent extends Event<TestEvent> {
    public static readonly NAME: string = "test_event";

    constructor() {
        super(TestEvent.NAME);
    }
}

class TestEvent1 extends Event<TestEvent1> {
    public static readonly NAME: string = "test_event1";

    constructor() {
        super(TestEvent1.NAME);
    }
}
class TestEvent2 extends Event<TestEvent2> {
    public static readonly NAME: string = "test_event2";

    constructor() {
        super(TestEvent2.NAME);
    }
}

describe('Dispatcher', function() {
    let dispatcher: Dispatcher;
    let spy1;
    let spy2;
    let spy3;
    let spy4;

    let event1: TestEvent1;
    let event2: TestEvent2;
    let spy5;
    let spy6;

    before(function() {
        spy1 = sinon.spy();
        spy2 = sinon.spy();
        spy3 = sinon.spy();
        spy4 = sinon.spy();
        spy5 = sinon.spy();
        spy6 = sinon.spy();

        dispatcher = new Dispatcher();
        dispatcher.addListener(TestEvent, spy1);
        dispatcher.addListener(TestEvent, spy2);
        dispatcher.addListener(TestEvent, spy3);

        event1 = new TestEvent1();
        event2 = new TestEvent2();

        dispatcher.addListener(TestEvent1, spy5);
        dispatcher.addListener(TestEvent2, spy6);
    });

    describe('#addListener()', function() {
        it('should add the listener', function() {
            dispatcher.dispatch(new TestEvent());
            spy4.should.not.have.been.called;
            dispatcher.addListener(TestEvent, spy4);
            dispatcher.dispatch(new TestEvent());
            spy4.should.have.been.called;
        });
    });

    describe('#dispatch()', function() {
        it('should call the listeners', function() {
            dispatcher.dispatch(new TestEvent());
            spy1.should.have.been.called;
            spy2.should.have.been.called;
            spy3.should.have.been.called;
        });


        it('should call the listeners with the right events', function() {
            dispatcher.dispatch(event1);
            dispatcher.dispatch(event2);
    
            spy5.should.be.calledWith({ event: event1 });
            spy6.should.be.calledWith({ event: event2 });
        });
    });
})