import cn from "classnames";
import React, { FunctionComponent } from "react";
import { Field } from "react-final-form";

import {
  formatNewLineDelimitedString,
  parseNewLineDelimitedString,
} from "coral-framework/lib/form";
import { Validator } from "coral-framework/lib/validation";

import ValidationMessage from "../../ValidationMessage";

import styles from "./WordListTextArea.css";

interface Props {
  className?: string;
  validate?: Validator;
  id?: string;
  name: string;
  disabled: boolean;
}

const WordListTextArea: FunctionComponent<Props> = ({
  id,
  name,
  disabled,
  validate,
  className,
}) => (
  <Field
    name={name}
    parse={parseNewLineDelimitedString}
    format={formatNewLineDelimitedString}
    validate={validate}
  >
    {({ input, meta }) => (
      <>
        <textarea
          id={id}
          className={cn(className, styles.textArea)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          {...input}
        />
        <ValidationMessage meta={meta} />
      </>
    )}
  </Field>
);

export default WordListTextArea;
