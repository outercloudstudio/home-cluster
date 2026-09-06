import { parseArgs } from '@std/cli/parse-args';
import { serve } from "./server.ts";
import { connect } from "./client.ts";
import { queue } from "./cli.ts";
import { proxy } from "./proxy.ts";

const args = parseArgs(Deno.args)

const isServer = args.serve ?? false
const isDaemon = args.daemon ?? false
const isProxy = args.proxy ?? false

if(isServer) {
	const port = args.port ?? 8080

	serve(port)
} else if(isDaemon) {
	const address = args.address

	if(!address) throw new Error('Must pass an address to connect to with --address')

	connect(address)
} else if(isProxy) {
    const address = args.address
	const localPort = args.localPort
	const remotePort = args.remotePort

    if(!address) throw new Error('Must pass an address to connect to with --address')
	if(!localPort) throw new Error('Must pass a port to proxy to with --localPort')
	if(!remotePort) throw new Error('Must pass a port to proxy to with --remotePort')

	proxy(address, localPort, remotePort)
} else if(args._.includes('queue')) {
	const image = args.image
	const command = args.command

	if(!image) throw new Error('You must supply an image to queue with --image')
	if(!command) throw new Error('You must supply a command to queue with --command')
	
	queue({
		image: image,
		command: command,
		label: args.label,
		maxRuntime: args.maxRuntime
	})
} else {
	console.log(args)	
}