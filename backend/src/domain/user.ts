export interface User {
	id: string;
	email: string;
	role: string;
	onboardingCompletedAt: Date | null;
	createdAt: Date;
}
