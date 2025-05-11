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
		netFile.Download().then(function(blob){
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
		netFile.Delete().then(onDelete);
	}
</script>
<style>
	button{
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;

		font-family: Montserrat;
		font-size: 14px;
		
		width: 120px;
		height: 100%;

		border-radius: 6px;
		border: 1px solid white;
		border: none !important;
		color: white;
		background-color: rgb(20, 20, 20);
	}

	button > svg{
		margin-left: -2px;
		margin-right: 6px;
	}

	button:hover{
		cursor: pointer;
		background-color: rgb(25, 25, 25);
	}

	button:active{
		background-color: rgb(40, 40, 40);
	}

	@media (max-width:600px) {
		button{
			font-size: 0px !important;
			width: 90%;
		}
		button > svg{
			margin: 0;
			stroke-width: 2;
		}
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
<td>
	<div class="download">
		<button on:click={DownloadFile}>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
			Download
		</button>
	</div>
</td>
<td>
	<div class="delete">
		<button on:click={DeleteFile}>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-icon lucide-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
			Delete
		</button>
	</div>
</td>