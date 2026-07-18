export class RegisterUserCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly roles?: string[],
    public readonly firstName?: string,
    public readonly lastName?: string,
    public readonly firstNameAr?: string,
    public readonly lastNameAr?: string,
    public readonly phone?: string,
    public readonly branchId?: string | null,
  ) {}
}
