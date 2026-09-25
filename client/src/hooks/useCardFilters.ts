import { useState, type Dispatch, type SetStateAction } from "react";
import type { CardFilterValues } from "../domain/deckBuilder";

type StringListSetter = Dispatch<SetStateAction<string[]>>;

export interface CardFiltersState extends CardFilterValues {
  setSearchText: Dispatch<SetStateAction<string>>;
  setSelectedCosts: StringListSetter;
  setSelectedTypes: StringListSetter;
  setSelectedSubtypes: StringListSetter;
  setSelectedKeywords: StringListSetter;
  setSelectedAtks: StringListSetter;
  setSelectedHps: StringListSetter;
  clearFilters: () => void;
}

export function useCardFilters(): CardFiltersState {
  const [searchText, setSearchText] = useState("");
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedAtks, setSelectedAtks] = useState<string[]>([]);
  const [selectedHps, setSelectedHps] = useState<string[]>([]);

  const clearFilters = () => {
    setSearchText("");
    setSelectedCosts([]);
    setSelectedTypes([]);
    setSelectedSubtypes([]);
    setSelectedKeywords([]);
    setSelectedAtks([]);
    setSelectedHps([]);
  };

  return {
    searchText,
    setSearchText,
    selectedCosts,
    setSelectedCosts,
    selectedTypes,
    setSelectedTypes,
    selectedSubtypes,
    setSelectedSubtypes,
    selectedKeywords,
    setSelectedKeywords,
    selectedAtks,
    setSelectedAtks,
    selectedHps,
    setSelectedHps,
    clearFilters,
  };
}
