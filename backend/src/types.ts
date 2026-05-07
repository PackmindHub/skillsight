export interface SessionUser {
	id: string;
	email: string;
	role: string;
}

export type AppVariables = {
	user: SessionUser;
	tokenJti: string;
};
