import { lookupModuleWithImportedPath } from '@revenge-mod/discord/utils/modules/finders'
import { lookupModule, lookupModules } from '@revenge-mod/modules/finders'
import {
	withDependencies,
	withProps,
} from '@revenge-mod/modules/finders/filters'
import { openSheet, roleMembersKey } from './navigation'
import { getRole } from './stores'
import type { Filter } from '@revenge-mod/modules/finders/filters'
import type { Metro } from '@revenge-mod/modules/types'
import type { ComponentType } from 'react'

/** Discord's own member list for a role; lazy, so it is fingerprinted then initialized. */
const SHEET_PATH = 'modules/messages/native/RoleMembersActionSheet.tsx'

/** Import order from the 348 bundle. Anchors below are resolved at runtime, never hardcoded. */
const SHEET_DEP_COUNT = 19

const CHANNEL_MEMBER_STORE_PATH = 'stores/ChannelMemberStore.tsx'
const GUILD_ROLE_STORE_PATH = 'stores/GuildRoleStore.tsx'
const SNOWFLAKE_PATH = 'utils/SnowflakeUtils.tsx'

export interface RoleMembersSheetProps {
	guildId: string
	roleId: string
	channelId?: string
}

let sheet: ComponentType<RoleMembersSheetProps> | undefined

function idOf(filter: Filter) {
	const result = lookupModule(filter, { initialize: false })
	return result.length === 2 ? result[1] : undefined
}

function pathId(path: string) {
	const result = lookupModuleWithImportedPath(path)
	return result.length === 2 ? result[1] : undefined
}

/**
 * Dependency-map fingerprint: React, React Native, the role/channel stores and
 * SnowflakeUtils sit at fixed positions; the rest of the map is left wild.
 */
function sheetFilter() {
	const reactId = idOf(withProps('createElement', 'useState', 'useEffect'))
	const nativeId = idOf(withProps('View', 'Text', 'StyleSheet'))
	const roleStoreId = pathId(GUILD_ROLE_STORE_PATH)
	const snowflakeId = pathId(SNOWFLAKE_PATH)
	const channelStoreId = pathId(CHANNEL_MEMBER_STORE_PATH)

	if (!reactId || !nativeId || !roleStoreId || !snowflakeId) return

	const deps = new Array<Metro.ModuleID | null>(SHEET_DEP_COUNT).fill(null)
	deps[0] = reactId
	deps[1] = nativeId
	if (channelStoreId) deps[3] = channelStoreId
	deps[4] = roleStoreId
	deps[10] = snowflakeId

	return withDependencies(deps)
}

/** Initializes the sheet once, then verifies the module by its imported path. */
export function resolveRoleMembersSheet(): boolean {
	if (sheet) return true

	try {
		const filter = sheetFilter()
		if (!filter) return false

		const matches = Array.from(
			lookupModules(filter, { cached: false, initialize: false }),
		)
		if (matches.length !== 1) return false

		const [, id] = matches[0]
		const resolved = lookupModule(filter, { initialize: true, cached: false })
		if (resolved.length !== 2) return false

		const component = (resolved[0] as { default?: unknown } | undefined)
			?.default
		if (typeof component !== 'function') return false
		if (pathId(SHEET_PATH) !== id) return false

		sheet = component as ComponentType<RoleMembersSheetProps>
		return true
	} catch {
		return false
	}
}

/** False when the sheet could not be resolved or the role is gone. */
export function openRoleMembers(guildId: string, roleId: string) {
	if (!resolveRoleMembersSheet() || !sheet || !getRole(guildId, roleId))
		return false

	openSheet(
		roleMembersKey(guildId, roleId),
		sheet,
		{ guildId, roleId },
		'stack',
	)
	return true
}
