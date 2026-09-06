import * as path from '@std/path'
import { decodeBase64 } from 'jsr:@std/encoding/base64'

export function proxy(address: string, localPort: number, remotePort: number) {
	const url = URL.parse(address)
	const host = url?.host
	const pathname = url?.pathname

	if(!host) throw new Error('Address must have a host!')
	if(!pathname) throw new Error('Address must have a pathname!')

	const websocketUrl = 'ws://' + path.join(host, pathname, 'proxy')

	const socket = new WebSocket(websocketUrl)

    const connections: Record<string, Deno.TcpConn> = {}

	socket.addEventListener('open', async () => {
		console.log('Successfully connected to the server!')

        socket.send(JSON.stringify({ type: 'setup', port: remotePort }))
	})

	socket.addEventListener('message', async (event) => {
		console.log('Message received from server:', event.data)

		let message: any = null

		try {
			message = JSON.parse(event.data)
		}catch {}

		if(!message) return

        if(message.type === 'new-client') {
            const connection = await Deno.connect({
                hostname: 'localhost',
                port: localPort,
                transport: 'tcp',
            })

            connections[message.id] = connection
        }

        if(message.type === 'close-client') {
            connections[message.id].close()
            delete connections[message.id]
        }
	})

	socket.addEventListener('error', (error) => {
		console.error('WebSocket error:', (error as ErrorEvent).message)
	})

	socket.addEventListener('close', async (event) => {
		console.log(`Connection closed. Code: ${event.code}, Reason: ${event.reason}`)
	})
}