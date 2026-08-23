import os from 'node:os'
import * as path from '@std/path'

export function getClientDaemonFilePath() {
	const home = os.homedir()

	if (Deno.build.os === 'windows') {
		return path.join(path.join(home, 'AppData', 'Local'), 'home-cluster', 'daemon.json')
	} else {
		const xdgData = Deno.env.get('XDG_DATA_HOME') ?? path.join(home, '.local', 'share')
		return path.join(xdgData, 'home-cluster', 'daemon.json')
	}
}