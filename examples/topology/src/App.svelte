<script>
	import vis from '../node_modules/vis-network';

	let topology
	let network
	let trackerEndpoint = "http://localhost:11111/topology/"
	let streamList = []

	function buildNetwork(stream) {
		// create an array with nodes
		var nodes = new vis.DataSet();

		// create an array with edges
		var edges = new vis.DataSet();

		let streamTopology = topology[stream]

		nodes.clear()
		edges.clear()

		Object.entries(streamTopology).map(([nodeId, neighbors]) => {
			nodes.add({
				id: nodeId,
				label: nodeId + "\nLeft-Aligned box"
			})

			neighbors.forEach((neighborId) => {
				const idAZ = nodeId + '_' + neighborId
				const idZA = neighborId + '_' + nodeId

				if (!edges.get(idAZ) && !edges.get(idZA)) {
					edges.add({
						id: idAZ,
						from: nodeId,
						to: neighborId
					})
				}
			})
		})

		// create a network
		let container = document.getElementById('network');
		let data = {
			nodes: nodes,
			edges: edges
		};
		let options = {
			nodes: {
				shape: 'dot',
				size: 16
			},
			layout:{
				randomSeed: 34
			},
			physics: {
				forceAtlas2Based: {
					gravitationalConstant: -26,
					centralGravity: 0.005,
					springLength: 230,
					springConstant: 0.18
				},
				maxVelocity: 146,
				solver: 'forceAtlas2Based',
				timestep: 0.35,
				stabilization: {
					enabled:true,
					iterations:2000,
					updateInterval:25
				}
			}
		};
		let network = new vis.Network(container, data, options);
		// alert(stream)
		//
		// // create an array with nodes
		// var nodes = new vis.DataSet();
		//
		// // create an array with edges
		// var edges = new vis.DataSet();
		//
		// // create a network
		// var container = document.getElementById('network');
		// console.log(container)
		// // container.css('border', '1px solidd red')
		// var data = {
		// 	nodes: nodes,
		// 	edges: edges
		// };
		//
		// var network = new vis.Network(container, data, options);

		return true
	}

	function handleFetch() {
		fetch(trackerEndpoint).then(function(response) {
			if (response.status !== 200) {
				console.error("Error. Got status %d for %s", response.status, tracker)
			} else {
				return response.json()
			}
		}).then((topologyJson) => {
			topology = topologyJson
			streamList = Object.keys(topology).sort()
		}).catch(function(err) {
			alert(err)
			console.error(err)
		})
	}
</script>

<main>
    <h1 class="title">Streamr Network Topology</h1>
	<div class="field is-horizontal">
		<div class="field-body">
			<div class="field">
				<p class="control has-icons-left">
					<input class="input is-primary" type="url" bind:value={trackerEndpoint}>
					<span class="icon is-small is-left"><i class="fa fa-search"></i></span>
				</p>
			</div>
			<div class="field">
				<div class="control">
					<button class="button is-success" on:click={handleFetch}>Fetch</button>
				</div>
			</div>
		</div>
	</div>
    <div class="columns full">
        <div class="column is-one-fifth">
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
        </div>
        <div id="network" class="column">
            Topology
        </div>
    </div>
</main>

