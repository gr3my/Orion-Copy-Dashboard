"use client";

import { Gate } from "../../components/gate";
import { OperatorsBody } from "../operators/page";

export default function ApiKeysPage() {
  return (
    <Gate perm="apikeys.read">
      <OperatorsBody writePerm="apikeys.write" title="API Keys" sub="Service and operator credentials. Secrets are shown once, stored as hashes." />
    </Gate>
  );
}
