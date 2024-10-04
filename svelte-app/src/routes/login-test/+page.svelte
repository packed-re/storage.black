<script>
	import {
		CryptoJS,
		GenerateBaseKey,
		GenerateAccountID,
		GenerateMasterKey,
	} from "$lib"

	import SpinningCircle from "../SpinningCircle.svelte";

	let status_box;
	
	let argon2_worker;
	function on_enter()
	{
		status_box.style.top = "20px"
		GenerateBaseKey("123", function(key){
			console.log(key.hashHex);
			status_box.style.top = "-60px";
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

	#status-box{
		transition: top 0.5s;

		position: fixed;
		top: -60px;

		display: flex;
		flex-direction: row;
		justify-content: start;
		align-items: center;

		background-color: rgb(20, 20, 20);
		border-radius: 10px;

		box-sizing: border-box;
		padding: 0 20px;

		width: 240px;
		height: 60px;
	}

	#status-box > p{
		color: white;
		font-size: 15px;

		margin: 0 0 0 30px;
		padding: 0;
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
		padding: 0 0 0 13px;
		box-sizing: border-box;
	}

	#login-window > input:focus {
		outline: none;
	}

	#login-window > button{		
		font-family: Montserrat;
		font-size: 15px;

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

<div id="status-box" bind:this={status_box}>
	<SpinningCircle size=30px speed=1.2s/>
	<p>Generating Key...</p>
</div>

<div id="login-window">
	<p>storage.black</p>
	<input type="password" placeholder="Passcode">
	<button on:click={on_enter}>Enter</button>
</div>

