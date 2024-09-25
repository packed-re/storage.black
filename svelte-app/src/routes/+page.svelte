<script>
	import argon2_script from "$lib/argon2.js?raw";

	import {
		CryptoJS,
		SliceWordArray,
		Uint8ArrayToWordArray,
		Uint8ArrayToLatin1,
		Latin1ToUint8Array,
		WordArrayToUint8Array,
		GenerateBaseKey,
		GenerateAccountKey,
		GenerateEncryptionKey,
		ShortEncrypt,
		ShortDecrypt
	} from "$lib";

	let key = CryptoJS.enc.Latin1.parse("12345678901234567890123456789012")
	function window_load()
	{
		//console.log(GenerateAccountKey("123"));
		//console.log(GenerateEncryptionKey("123"));


		let bytes = CryptoJS.enc.Utf8.parse("gayl12341fgfghdfghdfghsfghuytdfghsfght6ub45ubyutjftyjfygjfgjfghjfghjfghjfhgjfghjf234");
		console.log(bytes.toString());
		console.log(SliceWordArray(bytes, 2, 5).toString());

		let start = Date.now();
		for(let i = 0; i < 10000000; ++i)
		{
			SliceWordArray(bytes, 0, 80);
		}
		console.log(Date.now()-start);
		start = Date.now();
		for(let i = 0; i < 10000000; ++i)
		{
			(WordArrayToUint8Array(bytes).slice(0, 80));
		}
		console.log(Date.now()-start);
		return;
		let encrypted_data = ShortEncrypt("bufgfgu8hdf87ghdsf78hy54th8etrhgusdhgyu8dsgy78sht87wtr78dfhg98werdjt89werhtuiwerht87dcfb87hnwu549hditughufby78dfhisudfgnisdrbtuidsrbsdgsdfgh", key);
		console.log(encrypted_data.output.length, CryptoJS.enc.Latin1.parse(encrypted_data.output))

		new Blob([encrypted_data.output.substring(0, 100), encrypted_data.output.substring(100)]).text().then(function(text){
			console.log("text")
			console.log(text);
			console.log(ShortDecrypt(
				text, 
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
		// just use .text()
		let file = this.files[0];//.text().then(text => console.log(text));
		file.bytes().then(function(data_buffer)
		{
			let encrypted_data = ShortEncrypt(Uint8ArrayToWordArray(data_buffer), key);

			let enc_blob = new Blob([WordArrayToUint8Array(encrypted_data.iv.concat(encrypted_data.output))]);

			let blob_url = URL.createObjectURL(enc_blob);

			var link = document.createElement("a");
			link.href = blob_url;
			link.download = file.name + ".encrypted";
			link.innerText = "Click here to download the file";
			document.body.appendChild(link);
		})
	}

	function file_load_decrypt()
	{
		// just use .text()
		let file = this.files[0];//.text().then(text => console.log(text));
		file.bytes().then(function(data_buffer)
		{
			let iv = data_buffer.slice(0, 16);
			let data = data_buffer.slice(16);

			let encrypted_data = ShortDecrypt(Uint8ArrayToLatin1(data), key, Uint8ArrayToWordArray(iv));
			let enc_blob = new Blob([word]);

			let blob_url = URL.createObjectURL(enc_blob);

			var link = document.createElement("a");
			link.href = blob_url;
			link.download = file.name.substring(0, file.name.length - (".encrypted".length));
			link.innerText = "Click here to download the decr";
			document.body.appendChild(link);
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

123