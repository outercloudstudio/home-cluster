import { getClientDaemonFilePath } from "./util.ts";

export async function queue(options: {
	image: string,
	command: string,
	label?: string,
	maxRuntime?: number
}) {
	const daemonFilePath = getClientDaemonFilePath()

	try {
		await Deno.stat(daemonFilePath)
	} catch{
		throw new Error('You must launch the daemon before using cli commands!')
	}
	
	const port = JSON.parse(await Deno.readTextFile(daemonFilePath)).port

	console.log(`Sending message to daemon at http://localhost:${port}/queue`)

	await fetch(`http://localhost:${port}/queue`, {
		method: 'POST',
		body: JSON.stringify(options)
	})

	Deno.exit(0)
}