<script>
	import { onMount } from "svelte";

	onMount(function(){
		let api_base_url = "http://127.0.0.1";
		fetch(api_base_url,{
			method: "GET"
		}).then(function(response){
			response.blob().then(function(blob){
				var link = document.createElement("a");
				link.href = URL.createObjectURL(blob);
				link.download = file.name + ".encrypted";
				link.innerText = "[Blob Encrypt Test]";
				document.body.appendChild(link);
			});
	  })
  })	
</script>

<form action="http://127.0.0.1:80" method="POST" enctype="multipart/form-data">
	<label for="file">File</label>	
    <input type="hidden" name="MAX_FILE_SIZE" value="4000000" />
	<input id="file" name="userfile" type="file" />
	<input type="submit" value="Send File" />
 </form>