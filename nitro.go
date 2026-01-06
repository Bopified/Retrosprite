package main

import (
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strings"
)

type NitroFile struct {
	Files map[string][]byte
}

func NewNitroFile() *NitroFile {
	return &NitroFile{
		Files: make(map[string][]byte),
	}
}

func sanitizeImage(data []byte) []byte {
	// Check for "YVZa" prefix in case of double base64 encoding
	if len(data) > 4 && string(data[:4]) == "YVZa" {
		decoded1, err := base64.StdEncoding.DecodeString(string(data))
		if err == nil {
			if len(decoded1) > 8 && string(decoded1[:6]) == "iVBORw" {
				decoded2, err := base64.StdEncoding.DecodeString(string(decoded1))
				if err == nil {
					return decoded2
				}
			}
		}
	}
	return data
}

func readNitroWithGzipFallback(compressedData []byte, fileName string) ([]byte, error) {
	gzipReader, err := gzip.NewReader(bytes.NewReader(compressedData))
	if err != nil {
		return nil, fmt.Errorf("could not read file using zip for %s: %w", fileName, err)
	}
	defer gzipReader.Close()
	decompressedData, err := io.ReadAll(gzipReader)
	return decompressedData, err
}

func ReadNitro(path string) (*NitroFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	reader := bytes.NewReader(data)
	nf := NewNitroFile()

	var fileCount uint16
	if err := binary.Read(reader, binary.BigEndian, &fileCount); err != nil {
		return nil, fmt.Errorf("failed to read file count: %w", err)
	}

	for i := 0; i < int(fileCount); i++ {
		var nameLen uint16
		if err := binary.Read(reader, binary.BigEndian, &nameLen); err != nil {
			return nil, fmt.Errorf("failed to read name length at index %d: %w", i, err)
		}

		nameBytes := make([]byte, nameLen)
		if _, err := io.ReadFull(reader, nameBytes); err != nil {
			return nil, fmt.Errorf("failed to read name at index %d: %w", i, err)
		}
		fileName := string(nameBytes)

		var fileLen uint32
		if err := binary.Read(reader, binary.BigEndian, &fileLen); err != nil {
			return nil, fmt.Errorf("failed to read file length for %s: %w", fileName, err)
		}

		compressedData := make([]byte, fileLen)
		if _, err := io.ReadFull(reader, compressedData); err != nil {
			return nil, fmt.Errorf("failed to read compressed data for %s: %w", fileName, err)
		}
		var decompressedData []byte
		zlibReader, err := zlib.NewReader(bytes.NewReader(compressedData))
		if err != nil {
			decompressedData, err = readNitroWithGzipFallback(compressedData, fileName)
			if err != nil {
				return nil, fmt.Errorf("failed to decompress data for %s: %w", fileName, err)
			}
		} else {
			decompressedData, err = io.ReadAll(zlibReader)
			zlibReader.Close()
			if err != nil {
				return nil, fmt.Errorf("failed to decompress data for %s: %w", fileName, err)
			}
		}

		if strings.HasSuffix(fileName, ".png") {
			decompressedData = sanitizeImage(decompressedData)
		}

		nf.Files[fileName] = decompressedData
	}

	return nf, nil
}

func WriteNitro(path string, nf *NitroFile) error {
	buf := new(bytes.Buffer)

	fileCount := uint16(len(nf.Files))
	if err := binary.Write(buf, binary.BigEndian, fileCount); err != nil {
		return err
	}

	for name, data := range nf.Files {
		nameLen := uint16(len(name))
		if err := binary.Write(buf, binary.BigEndian, nameLen); err != nil {
			return err
		}

		if _, err := buf.WriteString(name); err != nil {
			return err
		}

		var compressedBuf bytes.Buffer
		zlibWriter := zlib.NewWriter(&compressedBuf)
		if _, err := zlibWriter.Write(data); err != nil {
			zlibWriter.Close()
			return err
		}
		zlibWriter.Close()

		compressedData := compressedBuf.Bytes()
		fileLen := uint32(len(compressedData))

		if err := binary.Write(buf, binary.BigEndian, fileLen); err != nil {
			return err
		}

		if _, err := buf.Write(compressedData); err != nil {
			return err
		}
	}

	return os.WriteFile(path, buf.Bytes(), 0644)
}
