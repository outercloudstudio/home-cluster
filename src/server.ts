export type TaskLaunchOptions = {
	image: string,
	command: string,
	label?: string,
	maxRuntime?: number
}

export type Task = {
	id: string,
	launch: TaskLaunchOptions
}

export type LaunchedTasks = {
	start: number,
	task: Task
}

const clients: Record<string, { socket: WebSocket, tasks: LaunchedTasks[] }> = {}
const taskQueue: Task[] = []

async function update() {
	const now = Date.now()

	for(const client of Object.values(clients)) {
		if(client.tasks.length > 0) continue

		for(const task of client.tasks) {
			if(task.task.launch.maxRuntime !== undefined && now - task.start > task.task.launch.maxRuntime)  {
				console.log(`Task "${task.task.launch.label}" exceeded max runtime of ${task.task.launch.maxRuntime}!`)

				taskQueue.unshift(task.task)
			}
		}

		if(taskQueue.length === 0) continue

		const task = taskQueue.shift()!

		client.socket.send(JSON.stringify({
			type: 'launch',
			task: task
		}))

		client.tasks.push({
			start: now,
			task,
		})

		console.log(`Dispatching task "${task.launch.label}"`)
	}
}

export function serve(port: number) {
	Deno.serve({ port }, async (request) => {
		const url = new URL(request.url)
		const path = url.pathname

		if(request.method === 'GET' && path === '/connect') return await handleConnect(request)

		return new Response('403 Forbidden', { status: 403 })
	})
}

async function handleConnect(request: Request): Promise<Response> {
	if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket upgrade request.', { status: 426 })

	const { socket, response } = Deno.upgradeWebSocket(request)

	const id = crypto.randomUUID()

	socket.addEventListener('open', () => {
		console.log('Client connected!')

		clients[id] = { socket, tasks: [] }		
	})

	socket.addEventListener('message', (event) => {
		console.log('Message received from client:', event.data)

		let message: any = null

		try {
			message = JSON.parse(event.data)
		}catch {}

		if(!message) return
		
		if(message.type === 'queue') {
			const taskId = crypto.randomUUID()
			taskQueue.push({
				id: taskId,
				launch: message.launchOptions
			})
		}

		if(message.type === 'complete') {
			const taskIndex = clients[id].tasks.findIndex(task => task.task.id === message.id)

			if(taskIndex === -1) throw new Error(`Tried to complete invalid task with id ${message.id}`)

			clients[id].tasks.splice(taskIndex, 1)
		}
	})

	socket.addEventListener('close', () => {
		console.log('Client disconnected.')

		for(const task of clients[id].tasks) {
			taskQueue.unshift(task.task)
		}
		
		delete clients[id]
	})

	socket.addEventListener('error', (error) => {
		console.error('WebSocket error:', (error as ErrorEvent).message)
	})

	return response
}

setInterval(() => {
	update()
}, 1000)