<script>
	import argon2_script from "$lib/argon2.js?raw";

	import {
		CryptoJS,
		CompareWordArrays,
		SliceWordArray,
		ChopWordArray,
		ArrayBufferToWordArray,
		Uint8ArrayToWordArray,
		Uint8ArrayToLatin1,
		Latin1ToUint8Array,
		WordArrayToUint8Array,
		GenerateBaseKey,
		GenerateAccountID,
		GenerateMasterKey,
		ShortEncrypt,
		ShortDecrypt,
		Encryptor
	} from "$lib";

	let key = CryptoJS.enc.Latin1.parse("12345678901234567890123456789012")
	function window_load()
	{
		console.log(CryptoJS.lib.WordArray.random(32).toString());
		console.log(CryptoJS.lib.WordArray.random(32).toString());
		console.log(CryptoJS.lib.WordArray.random(32).toString());

		let iv = CryptoJS.lib.WordArray.random(16);
		let aes_stream = CryptoJS.algo.AES.createEncryptor(key, {iv: iv});
		let cipher = aes_stream.process("busdfgsdfgh").concat(aes_stream.finalize());
		console.log(CryptoJS.AES.decrypt({ciphertext: cipher}, key, {
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,

			iv: iv
		}).toString(CryptoJS.enc.Utf8));

		console.log(Uint8ArrayToWordArray(WordArrayToUint8Array(CryptoJS.enc.Utf8.parse("hello"))).toString(CryptoJS.enc.Utf8));

		let encrypted_data = ShortEncrypt("yeeeerp", key);
		console.log(encrypted_data.output, encrypted_data.iv);

		new Blob([WordArrayToUint8Array(encrypted_data.output)]).bytes().then(function(data){
			console.log(ShortDecrypt(
				Uint8ArrayToWordArray(data), 
				key,
				encrypted_data.iv
			).toString(CryptoJS.enc.Utf8));
		})

		//eval(argon2_script); // Ideally I should be loading this script through a script tag in <svelte:head>, but the load event for that doesnt work properly so im stuck with this		
		//GenerateBaseKey("buh123", Argon2GenCallback);
	}
	
	function ReadFileArrayBuffer(file, callback)
	{
		let reader = new FileReader();
		reader.onload = (e) => callback(e.target.result);
		reader.readAsArrayBuffer(file);
	}

	function file_load()
	{
		let file = this.files[0];
		file.arrayBuffer().then(function(data_buffer) // because chrome doesnt support .bytes for whatever reason
		{
			let start = Date.now();
			console.log("encrypting", file.name);

			let encrypted_data = ShortEncrypt(ArrayBufferToWordArray(data_buffer), key);

			let enc_blob = new Blob([WordArrayToUint8Array(encrypted_data.iv.concat(encrypted_data.output))]);
			let blob_url = URL.createObjectURL(enc_blob);

			var link = document.createElement("a");
			link.href = blob_url;
			link.download = file.name + ".encrypted";
			link.innerText = "Click here to download the file";
			document.body.appendChild(link);

			console.log("finished encrypting", file.name, Date.now() - start);
		})
	}

	function file_load_decrypt()
	{
		let file = this.files[0];
		file.arrayBuffer().then(function(data_buffer) // because chrome doesnt support .bytes for whatever reason
		{
			data_buffer = ArrayBufferToWordArray(data_buffer);

			let iv = SliceWordArray(data_buffer, 0, 16);
			ChopWordArray(data_buffer, 16);

			console.log("decrypting", file.name);

			let plaintext = ShortDecrypt(data_buffer, key, iv);

			let enc_blob = new Blob([WordArrayToUint8Array(plaintext)]);
			let blob_url = URL.createObjectURL(enc_blob);

			var link = document.createElement("a");
			link.href = blob_url;
			link.download = file.name.substring(0, file.name.length - (".encrypted".length));
			link.innerText = "Click here to download the decr";
			document.body.appendChild(link);

			console.log("finished", file.name);
		});
	}

	function file_testing() // Im pretty sure using streamreaders, as encryptchunk does, is much faster than an .arrayBuffer call. I assume because the TypedArray is loaded directly and right away in C, instead of by us asking explicitly and flip flopping between the environments.
	{
		let file = this.files[0];//.text().then(text => console.log(text));
		let encryptor = new Encryptor(file, 10_000_000, key);		
		let outBlob = new Blob();
		console.log("blob",file.name);
		let start = Date.now();
		encryptor.EncryptChunk(function encChunk(ciphertext, done){
			outBlob = new Blob([outBlob, WordArrayToUint8Array(ciphertext)]);

			if(done)
			{
				let iv = encryptor.iv;
				let hmac = encryptor.RetrieveHMAC();

				var link = document.createElement("a");
				link.href = URL.createObjectURL(new Blob([WordArrayToUint8Array(iv.clone().concat(encryptor.hmac_secret_salt).concat(hmac)), outBlob]));
				link.download = file.name + ".encrypted";
				link.innerText = "[Blob Encrypt Test]";
				document.body.appendChild(link);
				console.log("finished blob encrypt", Date.now()-start)
				return;
			}
			else
				encryptor.EncryptChunk(encChunk);

		});
	}

	function Argon2GenCallback(argon2_hash)
	{
		console.log("a2 gen")
	}
</script>

<svelte:window on:load={window_load}/>
<input type="file" on:change={file_load}>
<input type="file" on:change={file_load_decrypt}>
<input type="file" on:change={file_testing}>

123