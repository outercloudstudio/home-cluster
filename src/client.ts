import * as path from '@std/path'
import { getClientDaemonFilePath } from "./util.ts";

export function connect(address: string) {
	const url = URL.parse(address)
	const host = url?.host
	const pathname = url?.pathname

	if(!host) throw new Error('Address must have a host!')
	if(!pathname) throw new Error('Address must have a pathname!')

	const websocketUrl = 'ws://' + path.join(host, pathname, 'connect')

	console.log(websocketUrl)

	const socket = new WebSocket(websocketUrl)

	socket.addEventListener('open', async () => {
		console.log('Successfully connected to the server!')

		const server = Deno.serve(async (request) => {
		const url = new URL(request.url)
		const path = url.pathname

			if(request.method === 'POST' && path === '/queue') {
				const launchOptions = await request.json()

				socket.send(JSON.stringify({
					type: 'queue',
					launchOptions
				}))

				return new Response('200 Ok', { status: 200 })
			}

			return new Response('403 Forbidden', { status: 403 })
		})

		const port = server.addr.port

		const daemonFilePath = getClientDaemonFilePath()
		const dirname = path.dirname(daemonFilePath)
		await Deno.mkdir(dirname, { recursive: true })
		await Deno.writeTextFile(daemonFilePath, JSON.stringify({ port }))
	})

	socket.addEventListener('message', async (event) => {
		console.log('Message received from server:', event.data)

		let message: any = null

		try {
			message = JSON.parse(event.data)
		}catch {}

		if(!message) return
		
		if(message.type === 'launch') {
			console.log(message)

			const image = message.task.launch.image
			const launchCommand = message.task.launch.command.replaceAll('${id}', message.task.id)

			const command = new Deno.Command('podman', {
				args: [
					'run',
					'--rm',
					image,
					'sh',
					'-c',
					launchCommand,
				],
				stdin: 'piped',
				stdout: 'piped',
			})

			console.log(`Launching task id ${message.task.id} with image ${image} and command ${launchCommand}`)

			const process = command.spawn()

			const result = await process.output()
			console.log(new TextDecoder().decode(result.stdout))

			socket.send(JSON.stringify({
				type: 'complete',
				id: message.task.id
			}))
		}
	})

	socket.addEventListener('error', (error) => {
		console.error('WebSocket encountered an error:', error)
	})

	socket.addEventListener('close', (event) => {
		console.log(`Connection closed. Code: ${event.code}, Reason: ${event.reason}`)
	})
}