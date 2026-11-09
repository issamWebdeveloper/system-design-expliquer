import { createElement } from "react";
import type { ConceptVisual as VisualId } from "@/types/schema";
import BloomFilter from "./BloomFilter";
import GeoGrid from "./GeoGrid";
import HashRing from "./HashRing";
import LedgerTable from "./LedgerTable";
import PrefixTrie from "./PrefixTrie";
import SnowflakeId from "./SnowflakeId";
import TokenBucket from "./TokenBucket";

const visuals: Record<VisualId, () => React.JSX.Element> = {
  "hash-ring": HashRing,
  "bloom-filter": BloomFilter,
  "token-bucket": TokenBucket,
  "prefix-trie": PrefixTrie,
  "snowflake-id": SnowflakeId,
  "geo-grid": GeoGrid,
  "ledger-table": LedgerTable,
};

/** Renders the interactive illustration for a concept (static lookup, safe during render). */
export default function ConceptVisual({ visual }: { visual: VisualId }) {
  return createElement(visuals[visual]);
}
