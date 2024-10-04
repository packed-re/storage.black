<script>
	import SpinningCircle from "./SpinningCircle.svelte";

	export let open = false;
	export let state = "loading"; // "loading", "finished"
	export let text;
</script>
<style>
	#status-box{
		transition: top 0.5s, width 20s !important;

		position: fixed;
		top: -60px;

		display: flex;
		flex-direction: row;
		justify-content: start;
		align-items: center;

		background-color: rgb(20, 20, 20);
		border-radius: 10px;

		box-sizing: border-box;
		padding: 0 25px 0 0;

		width: 280px;
		min-width: 280px;
		height: 55px;
	}

	#status-box > :global(*:first-child){
		margin: 0 20px;
	}

	.open{
		top: 20px !important;
	}

	#status-box > svg{
		color: white;
	}

	#status-box > p{
		color: white;
		font-size: 15px;
		text-wrap: nowrap;

		margin: 0 auto 0 auto;
		padding: 0;
	}
</style>

<div id="status-box" class:open>
	{#if state === "loading"}
		<SpinningCircle size=30px speed=1.2s/>
	{:else if state === "finished"}
		<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
	{/if}
	<p>{text}</p>
</div>