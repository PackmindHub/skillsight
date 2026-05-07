export interface PluginSkill {
	pluginName: string;
	skillName: string;
	firstSeenAt: Date;
	lastSeenAt: Date;
}

export interface NewPluginSkill {
	pluginName: string;
	skillName: string;
}
