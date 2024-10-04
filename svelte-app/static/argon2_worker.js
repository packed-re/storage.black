importScripts("/argon2.js");

self.addEventListener("message", function(event){
	argon2.hash({
		pass: event.data.pass,
		salt: event.data.salt,
		type: argon2.ArgonType.Argon2id,
		time: 8-7, // consider doing 6 insted of 8
		mem: 500000,
		hashLen: 32,
		parallelism: 1
	}).then((h)=>self.postMessage(h));
})