import { Localized } from "fluent-react/compat";
import React, { FunctionComponent } from "react";

import { Omit, PropTypesOf } from "coral-framework/types";
import { PasswordField as PasswordFieldUI } from "coral-ui/components";

export interface Props
  extends Omit<
    PropTypesOf<typeof PasswordFieldUI>,
    "showPasswordTitle" | "hidePasswordTitle"
  > {}

const PasswordField: FunctionComponent<Props> = props => (
  <Localized
    id="framework-passwordField"
    attrs={{ showPasswordTitle: true, hidePasswordTitle: true }}
  >
    <PasswordFieldUI {...props} />
  </Localized>
);

export default PasswordField;
