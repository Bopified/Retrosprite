package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
)

func LoadEffectMap(path string) (*EffectMap, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read EffectMap file: %w", err)
	}

	var em EffectMap
	if err := json.Unmarshal(data, &em); err != nil {
		return nil, fmt.Errorf("failed to parse EffectMap JSON: %w", err)
	}

	return &em, nil
}

func SaveEffectMap(path string, em *EffectMap) error {
	data, err := json.MarshalIndent(em, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal EffectMap: %w", err)
	}

	return os.WriteFile(path, data, 0644)
}

func AddEffectToMap(em *EffectMap, id string, lib string, effectType string, revision int) {
	// Check if effect already exists, update if so
	for i, e := range em.Effects {
		if e.ID == id {
			em.Effects[i].Lib = lib
			em.Effects[i].Type = effectType
			em.Effects[i].Revision = revision
			return
		}
	}

	em.Effects = append(em.Effects, EffectMapLibrary{
		ID:       id,
		Lib:      lib,
		Type:     effectType,
		Revision: revision,
	})
}

func RemoveEffectFromMap(em *EffectMap, id string) {
	for i, e := range em.Effects {
		if e.ID == id {
			em.Effects = append(em.Effects[:i], em.Effects[i+1:]...)
			return
		}
	}
}

func ParseEffectMapXML(data []byte) (*EffectMap, error) {
	var xmlMap EffectMapXML
	if err := xml.Unmarshal(data, &xmlMap); err != nil {
		return nil, fmt.Errorf("failed to parse EffectMap XML: %w", err)
	}

	em := &EffectMap{
		Effects: make([]EffectMapLibrary, 0, len(xmlMap.Effects)),
	}

	for _, e := range xmlMap.Effects {
		em.Effects = append(em.Effects, EffectMapLibrary{
			ID:       e.ID,
			Lib:      e.Lib,
			Type:     e.Type,
			Revision: e.Revision,
		})
	}

	return em, nil
}
