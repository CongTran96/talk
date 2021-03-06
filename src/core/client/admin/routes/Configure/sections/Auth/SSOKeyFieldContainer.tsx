import React from "react";
import { graphql } from "react-relay";

import { SSOKeyFieldContainer_sso as SSOData } from "coral-admin/__generated__/SSOKeyFieldContainer_sso.graphql";
import {
  MutationProp,
  withFragmentContainer,
  withMutation,
} from "coral-framework/lib/relay";

import RegenerateSSOKeyMutation from "./RegenerateSSOKeyMutation";
import SSOKeyField from "./SSOKeyField";

interface Props {
  sso: SSOData;
  disabled?: boolean;
  regenerateSSOKey: MutationProp<typeof RegenerateSSOKeyMutation>;
}

interface State {
  awaitingResponse: boolean;
}

class SSOKeyFieldContainer extends React.Component<Props, State> {
  public state = {
    awaitingResponse: false,
  };

  private handleRegenerate = async () => {
    this.setState({ awaitingResponse: true });
    await this.props.regenerateSSOKey();
    this.setState({ awaitingResponse: false });
  };

  public render() {
    const { disabled } = this.props;
    return (
      <SSOKeyField
        disabled={disabled || this.state.awaitingResponse}
        generatedKey={this.props.sso.key || undefined}
        keyGeneratedAt={this.props.sso.keyGeneratedAt || undefined}
        onRegenerate={this.handleRegenerate}
      />
    );
  }
}

const enhanced = withMutation(RegenerateSSOKeyMutation)(
  withFragmentContainer<Props>({
    sso: graphql`
      fragment SSOKeyFieldContainer_sso on SSOAuthIntegration {
        key
        keyGeneratedAt
      }
    `,
  })(SSOKeyFieldContainer)
);

export default enhanced;
