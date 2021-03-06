import { Localized } from "fluent-react/compat";
import React, { FunctionComponent } from "react";
import { Field } from "react-final-form";

import { colorFromMeta, ValidationMessage } from "coral-framework/lib/form";
import { validateEmail } from "coral-framework/lib/validation";
import {
  FieldSet,
  FormField,
  InputLabel,
  TextField,
} from "coral-ui/components";

interface Props {
  index: number;
  disabled: boolean;
}

const EmailField: FunctionComponent<Props> = ({ index, disabled }) => (
  <FieldSet>
    <Field name={`emails.${index}`} validate={validateEmail}>
      {({ input, meta }) => (
        <FormField>
          <Localized id="community-invite-emailAddressLabel">
            <InputLabel
              container="legend"
              variant="bodyCopyBold"
              htmlFor={input.name}
            >
              Email Address:
            </InputLabel>
          </Localized>
          <TextField
            data-testid={`invite-users-email.${index}`}
            color={colorFromMeta(meta)}
            disabled={disabled}
            fullWidth
            {...input}
          />
          <ValidationMessage meta={meta} fullWidth />
        </FormField>
      )}
    </Field>
  </FieldSet>
);

export default EmailField;
