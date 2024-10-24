<script>
	import SortButton from "./SortButton.svelte";
	import FileListing from "./FileListing.svelte";
    import { writable } from "svelte/store";
	
	export let files;

	let sort_state = writable({
		name: "Upload Date",
		state: null//"DESC"
	});
</script>
<style>
	#file-browser{
		height: 1px; /* why? */
		width: 100%;
		color: white;
	}

	#file-browser > thead > tr > th{
		height: 50px;
		border-bottom: 1px solid white;
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
</style>

	<table id="file-browser" border=0 cellspacing=0>
		<thead>
			<tr>
				<th style="min-width: 100px">
					<div>
						<SortButton name="Name" sort_state={sort_state}/>
					</div>
				</th>
				<th style="width: 160px">
					<div>
						<SortButton name="Upload Date" sort_state={sort_state}/>
					</div>
				</th>
				<th style="width: 100px">
					<div>
						<SortButton name="File Size" sort_state={sort_state}/>
					</div>
				</th>
				<th style="width: 150px"></th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<FileListing
					name="Test File Name"
					timestamp={Math.floor(Date.now()/1000)}
					file_size=1234
				/>				
			</tr>
			<tr>
				<FileListing
					name="Test File Name"
					timestamp={Math.floor(Date.now()/1000)}
					file_size=1234
				/>
			</tr>
		</tbody>
	</table>
