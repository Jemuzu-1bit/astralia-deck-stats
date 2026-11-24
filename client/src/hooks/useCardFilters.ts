import { useState, type Dispatch, type SetStateAction } from "react";
import { CARD_SETS, type CardFilterValues, type CardSet } from "../domain/deckBuilder";

type StringListSetter = Dispatch<SetStateAction<string[]>>;

export interface CardFiltersState extends CardFilterValues {
  setSearchText: Dispatch<SetStateAction<string>>;
  toggleSelectedSet: (set: CardSet) => void;
  clearSelectedSets: () => void;
  setSelectedRarities: StringListSetter;
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
  const [selectedSets, setSelectedSets] = useState<CardSet[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedAtks, setSelectedAtks] = useState<string[]>([]);
  const [selectedHps, setSelectedHps] = useState<string[]>([]);

  const toggleSelectedSet = (set: CardSet) => {
    setSelectedSets(current => {
      const next = current.includes(set) ? current.filter(value => value !== set) : [...current, set];
      return next.length === CARD_SETS.length ? [] : next;
    });
  };

  const clearSelectedSets = () => setSelectedSets([]);

  const clearFilters = () => {
    setSearchText("");
    clearSelectedSets();
    setSelectedRarities([]);
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
    selectedSets,
    toggleSelectedSet,
    clearSelectedSets,
    selectedRarities,
    setSelectedRarities,
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
