
function LogN(x, y)
{
	return Math.log(y) / Math.log(x);
}

function RoundN(value, precision)
{
	let base = Math.pow(10, precision);
	return Math.round(value * base) / base;
}

export {
	LogN,
	RoundN
};