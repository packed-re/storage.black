import {
	setThing,
	getThing
} from "./test.js";

function doTest()
{
	console.log(getThing())
	setThing(getThing() + 1);
}

export {doTest};