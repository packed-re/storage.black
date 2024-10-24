<script>
	// the state of this component should be handled externally

	export let name;
	export let sort_state;
	export let styles = "";

	function set_state()
	{
		$sort_state = {
			name: name,
			state: ($sort_state.state === null || $sort_state.name !== name) ? "DESC" : ($sort_state.state === "ASC" ? null : "ASC")
		};
	}
</script>
<style>
	p{
		margin: 0;
		padding: 0;
	}
</style>
<!--<button on:click={set_state}>t1</button>-->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<p on:click style={styles}>{name}{$sort_state.name !== name || $sort_state.state === null ? "" : ($sort_state.state === "ASC" ? " ⯅" : " ⯆")}</p>