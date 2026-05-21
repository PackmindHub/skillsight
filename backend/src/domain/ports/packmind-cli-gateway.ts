export interface PackmindPackage {
	slug: string;
	spaceSlug: string;
	spaceName: string;
	displayName: string;
	url: string | null;
}

export interface PackmindPackageSkill {
	name: string;
	description: string | null;
}

export interface PackmindPackageDetail extends PackmindPackage {
	skills: PackmindPackageSkill[];
}

export interface PackmindWhoami {
	user: string;
	org: string;
	host: string;
}

export interface IPackmindCliGateway {
	whoami(apiKey: string): Promise<PackmindWhoami>;
	listPackages(apiKey: string): Promise<PackmindPackage[]>;
	showPackage(apiKey: string, slug: string): Promise<PackmindPackageDetail>;
}
