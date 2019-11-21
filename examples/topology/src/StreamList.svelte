<script>
    export let streamList = []
    export let buildNetwork
</script>
<nav class="panel">
    <p class="panel-heading">
        List of streams:
    </p>
    <div class="panel-block">
        <p class="control has-icons-left">
            <input class="input" type="text" placeholder="Search">
            <span class="icon is-left">
							<i class="fas fa-search" aria-hidden="true"></i>
						</span>
        </p>
    </div>
    {#each streamList as stream}
        <a class="panel-block is-active"  on:click|preventDefault={() => buildNetwork(stream)}>
					<span class="panel-icon">
						<i class="fas fa-book" aria-hidden="true"></i>
					</span>
            {stream}
        </a>
    {/each}
</nav>
