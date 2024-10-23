<script>
	import { CryptoJS, Uint8ArrayToWordArray } from "$lib";
	import { onMount } from "svelte";
	import { CheckSession, CreateSession, FetchEncryptionKey, ClearSession } from "$lib/session"

	onMount(function(){
		console.log(CheckSession());
		CreateSession(CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64)).then(function(v){
			console.log("c1", v.toString(CryptoJS.enc.Hex));			
			console.log(CheckSession());
			FetchEncryptionKey().then(function(v){
				console.log("c2", v.toString(CryptoJS.enc.Hex))
				//ClearSession();
			});
		});
		return;
		let formData = new FormData()
		formData.append("buh", "123");
		formData.append("this is a file", new Blob(["123"]), "realest_file.bin");
		
		let api_base_url = "http://127.0.0.1";
		fetch(api_base_url,{
			method: "POST",
			body: formData
		}).then(function(response){
			response.text().then(s=>console.log(s));
		})
	})	
</script>
<form action="http://127.0.0.1:80" method="POST" enctype="multipart/form-data">
	<label for="file">File</label>	
    <input type="hidden" name="MAX_FILE_SIZE" value="4000000" />
	<input id="file" name="userfile" type="file" />
	<input type="submit" value="Send File" />
 </form>
  