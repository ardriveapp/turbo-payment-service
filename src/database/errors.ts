import { UserAddress } from "./dbTypes";

export class UserNotFoundWarning extends Error {
  constructor(userAddress: UserAddress) {
    super(`No user found in database with address '${userAddress}'`);
    this.name = "UserNotFoundWarning";
  }
}
