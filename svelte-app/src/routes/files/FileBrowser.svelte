<script>
    import { onMount } from "svelte";
    import { writable } from "svelte/store";

	import { LoadSession } from "$lib/file_api";

	import SortButton from "./SortButton.svelte";
	import FileListing from "./FileListing.svelte";

	let sort_state = writable({
		name: "Upload Date",
		state: null//"DESC"
	});	
	let session;

	let fileListingTableBody;

	function ListNetFiles(netFiles)
	{
		while(fileListingTableBody.firstChild)
			fileListingTableBody.removeChild(fileListingTableBody.firstChild);

		if(netFiles.length === 0)
			fileListingTableBody.appendChild(document.createElement("p")).innerHTML = `<p style="text-align:center">No files found</p>`;
		else
			for(let netFile of netFiles)
			{
				let tr = document.createElement("tr")
				new FileListing({
					target: fileListingTableBody.appendChild(tr),
					props: {
						netFile: netFile,
						onDelete: () => tr.remove()
					}
				});
			}
	}

	function UploadFile(event)
	{
		let input = document.createElement("input");
		input.type = "file";
		input.click();
		input.addEventListener("change", function(e){
			let file = e.target.files[0];
			console.log("changed", file);
			session.UploadFile(file).then(function()
			{
				console.log("done");
				session.ListFiles().then(ListNetFiles);
			})
		});
		console.log("clicking")
	}

	onMount(async function(){
		session = await LoadSession();
		if(session === false)		
			window.location.replace("/");
		
		session.ListFiles().then(ListNetFiles);
		/*let netFiles = 
		[
			{
				fileSizeNum: 10000,
				metadata: {
					name: "recipes.txt"
				}
			},
			{
				fileSizeNum: 161830000,
				metadata: {
					name: "photos.zip"
				}
			}
		];
		ListNetFiles(netFiles);*/
	})
</script>
<style>
	#file-browser{
		width: 100%;
		color: white;
	}

	button{
		font-family: Montserrat;
		font-size: 14px;

		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;

		color: white;
		background-color: rgb(30, 30, 30);

		border: none;
		border-radius: 6px;

		margin: 8px auto 8px 16px;
		padding: 8px 30px;		
	}

	@media (max-width: 600px){
		button{
			padding: 8px 40dvw;
			margin-left: auto;
			margin-right: auto;
		}
		.button-header{
			width: 20% !important;
		}
	}

	@media (max-width:500px) {
	}
	
	button:hover{
		cursor: pointer;
		background-color: rgb(35, 35, 35);		
	}

	button:active{
		background-color: rgb(40, 40, 40);		
	}

	:global(#file-browser th){
		font-weight: 300;
		font-size: 16px;
		
		height: 35px;

		user-select: none;		
		border-bottom: 1px solid rgb(210, 210, 210);
	}

	:global(#file-browser tbody > tr:nth-child(1) > td){
		padding: 10px 0 5px 0;
	}

	:global(#file-browser td){
		font-weight: 300;
		font-size: 15px;
		
		height: 35px;
		padding: 5px 0;
	}

	:global(#file-browser th > div), :global(#file-browser td > div){
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;

		width: 100%;
		height: 100%;
	}

	:global(#file-browser th:nth-child(1) > div), :global(#file-browser td:nth-child(1) > div){
		display: flex;
		flex-direction: row;
		justify-content: start;
		align-items: center;

		width: 100%;
		height: 100%;

		box-sizing: border-box;
		padding-left: 20px;
	}

	:global(#file-browser td:last-child > div){
		box-sizing: border-box;
		padding-right: 10px;
	}
</style>

<!-- svelte-ignore a11y-no-static-element-interactions (kys svelte)--> 
<div
	style="width: 100%; height: 100%"
>
	<button on:click={UploadFile}>
		Upload
	</button>
	<table id="file-browser" border=0 cellspacing=0>
		<thead>
			<tr>
				<th style="min-width: 100px">
					<div>
						<SortButton name="Name" sort_state={sort_state}/>
					</div>
				</th>
				<!--<th style="width: 160px">
					<div>
						<SortButton name="" sort_state={sort_state}/>
					</div>
				</th>-->
				<th style="width: 100px">
					<div>
						<SortButton name="File Size" sort_state={sort_state}/>
					</div>
				</th>
				<th class="button-header" style="width: 130px"></th>
				<th class="button-header" style="width: 130px"></th>
			</tr>
		</thead>
		<tbody bind:this={fileListingTableBody}>
			<p style="text-align:center">No files found</p>
			
			<!--<tr>
				<FileListing
					name="Test File Name"
					timestamp={Math.floor(Date.now()/1000)}
					file_size=123456
				/>				
			</tr>
			<tr>
				<FileListing
					name="Test File Name"
					timestamp={Math.floor(Date.now()/1000)}
					file_size=12345678
				/>
			</tr>-->
		</tbody>
	</table>
</div>
