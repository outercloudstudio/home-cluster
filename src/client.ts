import * as path from '@std/path'
import { getClientDaemonFilePath } from "./util.ts";

export function connect(address: string) {
	const url = URL.parse(address)
	const host = url?.host
	const pathname = url?.pathname

	if(!host) throw new Error('Address must have a host!')
	if(!pathname) throw new Error('Address must have a pathname!')

	const websocketUrl = 'ws://' + path.join(host, pathname, 'connect')

	const socket = new WebSocket(websocketUrl)

    const activeContainerProcesses: Deno.ChildProcess[] = []
    let server: Deno.HttpServer<Deno.NetAddr> | null = null

	socket.addEventListener('open', async () => {
		console.log('Successfully connected to the server!')

		server = Deno.serve(async (request) => {
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

			try {
                const process = command.spawn()
                activeContainerProcesses.push(process)

                await process.output()
                activeContainerProcesses.splice(activeContainerProcesses.indexOf(process), 1)

                socket.send(JSON.stringify({
                    type: 'complete',
                    id: message.task.id
                }))
            } catch(exception) {
                console.warn(`Container exception: ${exception}`)
            }
		}
	})

	socket.addEventListener('error', (error) => {
		console.error('WebSocket error:', (error as ErrorEvent).message)
	})

	socket.addEventListener('close', async (event) => {
		console.log(`Connection closed. Code: ${event.code}, Reason: ${event.reason}`)

        if(server) await server.shutdown()

        for(const process of activeContainerProcesses) {
            process.kill()
        }

        console.warn('Disconnected from server. Attempting reconnection...')
        setTimeout(() => {
            connect(address)
        }, 5000);
	})
}