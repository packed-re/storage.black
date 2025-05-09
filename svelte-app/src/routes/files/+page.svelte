<script>
	import FileBrowser from "./FileBrowser.svelte";
	import { ClearSession, LoadSession } from "$lib/file_api";

	function Logout()
	{
		ClearSession().then(function(){
			window.location.replace("/login");
		})
	}
</script>
<style>
	@font-face{
		font-family: Montserrat;
		src: url(/Montserrat-Variablet.ttf);
	}

	:global(body){
		display: flex;
		flex-direction: column;
		justify-content: start;
		align-items: center;

		font-family: Montserrat;

		margin: 0;
		padding: 0;

		width: 100%;
		height: 100dvh;

		background-color: rgb(0,0,0);
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

		margin: 8px 8px 8px auto;
		padding: 8px 16px;		
	}

	button > svg{
		margin-left: 10px;
	}

	button:hover{
		cursor: pointer;
		background-color: rgb(35, 35, 35);		
	}

	button:active{
		background-color: rgb(40, 40, 40);		
	}
</style>


<button on:click={Logout}>Log Out <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg></button>
	
<FileBrowser/>
