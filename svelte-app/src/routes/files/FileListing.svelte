<script>
	export let name;
	export let timestamp;
	export let file_size;

	let date = new Date(timestamp * 1000);
	let date_string = date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear();
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

<td><div>{name}</div></td>
<td><div>{date_string}</div></td>
<td><div>{file_size}</div></td>
<td><div><button>Download</button></div></td>