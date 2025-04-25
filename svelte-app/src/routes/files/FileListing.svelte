<script>
	export let netFile;
	export let onDelete;
	//export let timestamp;
	//export let file_size;	

	import {
		LogN,
		RoundN
	} from "$lib/math";

	const ByteUnits = [
		"B",
		"KB",
		"MB",
		"GB",
		"TB",
		"PB"
	];

	function FormatByteCount(bytes)
	{
		let byteUnitI = Math.floor(Math.floor(LogN(10, bytes) + 0.0001) / 3);
		if(byteUnitI >= ByteUnits.length)
			byteUnitI = ByteUnits.length - 1;
		
		let byteBase = Math.pow(10, 3 * byteUnitI);
		let normalizedByteCount = RoundN(bytes / byteBase, 2);

		return normalizedByteCount + " " + ByteUnits[byteUnitI];
	}

	function FormatUnixTimestamp(timestamp)
	{
		let date = new Date(timestamp * 1000);

		return date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear();
	}

	function DownloadFile()
	{
		netFile.DownloadFile().then(function(blob){
			var a = document.body.appendChild(document.createElement("a"));
			a.style = "display: none";
			a.download = netFile.metadata.name;

			objectUrl = window.URL.createObjectURL(blob);			
			a.href = objectUrl;
			a.click();

			window.URL.revokeObjectURL(objectUrl);
		});		
	}

	function DeleteFile()
	{
		netFile.DeleteFile().then(onDelete);
	}
</script>
<style>
	button{
		font-family: Montserrat;
		font-size: 14px;
		
		width: 100%;
		height: 100%;

		border-radius: 6px;
		border: 1px solid white;
		border: none !important;
		color: white;
		background-color: rgb(20, 20, 20);
	}

	button:hover{
		cursor: pointer;
		background-color: rgb(25, 25, 25);
	}

	button:active{
		background-color: rgb(40, 40, 40);
	}

	/*button{
		font-family: Montserrat;
		
		width: 100%;
		height: 100%;

		border-radius: 6px;
		border: 1px solid white;

		color: white;
		background-color: black;
	}

	button:hover{
		cursor: pointer;
		background-color: rgb(20, 20, 20);
	}

	button:active{
		background-color: rgb(40, 40, 40);
	}*/
</style>

<td><div>{netFile.metadata.name}</div></td>
<!--<td><div>{FormatUnixTimestamp(timestamp)}</div></td>-->
<td><div>{FormatByteCount(netFile.fileSizeNum)}</div></td>
<td><div><button on:click={DownloadFile}>Download</button></div></td>
<td><div><button on:click={DeleteFile}>Delete</button></div></td>