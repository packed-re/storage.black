<script>
	import {
		CryptoJS,
		GenerateBaseKey,
		GenerateAccountID,
		GenerateMasterKey,
	} from "$lib"

	import StatusBox from "../StatusBox.svelte";

	let passcode_input;
	
	let status_box_data = {
		open: false,
		state: "loading",
		text: "Generating Key..."
	}
	function on_enter()
	{
		status_box_data.open = true;
		GenerateBaseKey(passcode_input.value, function(key){
			console.log(key.hashHex);			
			status_box_data.state = "finished";
			status_box_data.text = "Key Successfully Generated!"
		});
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
		justify-content: center;
		align-items: center;

		font-family: Montserrat;

		margin: 0;
		padding: 0;

		width: 100%;
		height: 100dvh;

		background-color: rgb(0,0,0);
	}

	#login-window{		
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;

		width: 100%;
		--control-width: min(350px, 85%);
	}

	#login-window > p{
		text-transform: uppercase;
		user-select: none;
		
		position: relative;
		bottom: 120px;

		font-size: 40px;
		font-weight: 600;

		background: linear-gradient(84.48deg, #8F00FF, #FF00E6);
		background-clip: text;
		-webkit-text-fill-color: transparent;

		margin: 0;
		padding: 0;	
	}

	#login-window > input{
		font-family: Montserrat;
		font-size: 15px;

		border: none;
		border-radius: 5px;

		width: var(--control-width);
		height: 37px;

		margin: 0;
		padding: 0 13px;
		box-sizing: border-box;
	}

	#login-window > input:focus {
		outline: none;
	}

	#login-window > button{		
		font-family: Montserrat;
		font-size: 15px;

		cursor: pointer;

		border: none;
		border-radius: 4px;
		color: white;
		background-color: rgb(0, 80, 255);

		width: var(--control-width);
		height: 37px;

		margin: 10px 0 0 0;
		padding: 0;
	}
	
	#login-window > button:hover{	
		background-color: rgb(0, 100, 255);
	}
	
	#login-window > button:active{	
		background-color: rgb(0, 115, 255);
	}
	@media (width < 560px) {
		#login-window > p{
			font-size: calc(100dvw / 10);
			bottom: 120px;
		}
	}
</style>

<StatusBox {...status_box_data}/>
<div id="login-window">
	<p>storage.black</p>
	<input type="password" placeholder="Passcode" bind:this={passcode_input}>
	<button on:click={on_enter}>Enter</button>
</div>

