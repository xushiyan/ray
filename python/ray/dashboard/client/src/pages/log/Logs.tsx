import {
  Box,
  Button,
  IconButton,
  Link,
  List,
  ListItem,
  Paper,
  Typography,
} from "@mui/material";
import { grey } from "@mui/material/colors";
import React, { useMemo, useState } from "react";
import { RiDownload2Line } from "react-icons/ri";
import { Outlet, Link as RouterLink, useSearchParams } from "react-router-dom";
import useSWR from "swr";
import { StateApiLogViewer } from "../../common/MultiTabLogViewer";
import { SearchInput } from "../../components/SearchComponent";
import TitleCard from "../../components/TitleCard";
import { getStateApiDownloadLogUrl, listStateApiLogs } from "../../service/log";
import { getNodeList } from "../../service/node";
import { MainNavPageInfo } from "../layout/mainNavContext";

export const StateApiLogsListPage = () => {
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get("nodeId");
  const folder = searchParams.get("folder");
  const fileNameParam = searchParams.get("fileName");
  const [fileName, setFileName] = useState(fileNameParam || "");

  const backFolder = folder
    ? [...folder.split("/").slice(0, -1)].join("/")
    : undefined;
  const backHref =
    // backGlob is undefined when glob is empty
    // backGlob is empty string when glob is 1 level deep.
    backFolder !== undefined && nodeId
      ? `/logs/?nodeId=${encodeURIComponent(
          nodeId,
        )}&folder=${encodeURIComponent(backFolder)}`
      : `/logs/`;

  return (
    <Box sx={{ padding: 2, width: "100%" }}>
      <TitleCard title="Logs Viewer">
        <Paper elevation={0}>
          {!nodeId && <p>Select a node to view logs</p>}
          {nodeId && (
            <React.Fragment>
              <p>Node: {nodeId}</p>
              <p>{decodeURIComponent(folder || "")}</p>
            </React.Fragment>
          )}
          {nodeId && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "center",
                margin: 1,
                gap: 2,
              }}
            >
              <Button component={RouterLink} variant="contained" to={backHref}>
                Back To ../
              </Button>
              <SearchInput
                defaultValue={fileName}
                label="File Name"
                onChange={(val) => {
                  setFileName(val);
                }}
              />
            </Box>
          )}
        </Paper>
        <Paper elevation={0}>
          {nodeId ? (
            <StateApiLogsFilesList
              nodeId={nodeId}
              folder={folder}
              fileName={fileName}
            />
          ) : (
            <StateApiLogsNodesList />
          )}
        </Paper>
      </TitleCard>
    </Box>
  );
};

export const StateApiLogsNodesList = () => {
  const { data: nodes, error } = useSWR(["/api/v0/nodes"], async () => {
    const resp = await getNodeList();
    const nodes = resp.data.data.summary;
    return nodes.filter((node) => node.raylet.state === "ALIVE");
  });

  const isLoading = nodes === undefined && error === undefined;

  return (
    <React.Fragment>
      {isLoading ? (
        <Typography>Loading...</Typography>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <List>
          {nodes?.map(({ raylet: { nodeId }, ip }) => (
            <ListItem key={nodeId}>
              <Link component={RouterLink} to={`?nodeId=${nodeId}`}>
                Node ID: {nodeId} (IP: {ip})
              </Link>
            </ListItem>
          ))}
        </List>
      )}
    </React.Fragment>
  );
};

type StateApiLogsFilesListProps = {
  nodeId: string;
  folder: string | null;
  fileName: string;
};

export const StateApiLogsFilesList = ({
  nodeId,
  folder,
  fileName,
}: StateApiLogsFilesListProps) => {
  // We want to do a partial search for file name.
  const fileNameGlob = fileName ? `*${fileName}*` : undefined;
  const glob = fileNameGlob
    ? folder
      ? `${folder}/${fileNameGlob}`
      : `${fileNameGlob}`
    : folder
    ? `${folder}/*`
    : undefined;

  const { data: fileGroups, error } = useSWR(
    nodeId ? ["/api/v0/logs", nodeId, glob] : null,
    async ([_, nodeId, glob]) => {
      const resp = await listStateApiLogs({ nodeId, glob });
      return resp.data.data.result;
    },
  );

  const isLoading = fileGroups === undefined && error === undefined;

  const files = useMemo(
    () =>
      (fileGroups !== undefined
        ? Object.values(fileGroups)
            .flatMap((e) => e)
            .sort()
        : []
      ).map((fileName) => {
        const isDir = fileName.endsWith("/");
        const fileNameWithoutEndingSlash = fileName.substring(
          0,
          fileName.length - 1,
        );
        const parentFolder = folder ? `${folder}/` : "";
        const fileNameWithoutParent = fileName.startsWith(parentFolder)
          ? fileName.substring(parentFolder.length)
          : fileName;

        const linkPath = isDir
          ? `?nodeId=${encodeURIComponent(nodeId)}&folder=${encodeURIComponent(
              fileNameWithoutEndingSlash,
            )}`
          : `viewer?nodeId=${encodeURIComponent(
              nodeId,
            )}&fileName=${encodeURIComponent(fileName)}`;

        const downloadUrl = isDir
          ? undefined
          : getStateApiDownloadLogUrl({
              nodeId,
              filename: fileName,
              maxLines: -1,
            });

        return {
          fileName,
          name: fileNameWithoutParent,
          linkPath,
          isDir,
          downloadUrl,
        };
      }),
    [fileGroups, folder, nodeId],
  );

  return (
    <React.Fragment>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        files.length === 0 && <p>No files found.</p>
      )}
      {files && (
        <List>
          {files.map(({ fileName, name, downloadUrl, linkPath }) => {
            return (
              <ListItem key={fileName}>
                <Link component={RouterLink} to={linkPath}>
                  {name}
                </Link>
                {downloadUrl && (
                  <Box paddingLeft={0.5}>
                    <IconButton
                      component="a"
                      href={downloadUrl}
                      download={fileName}
                      size="small"
                      sx={{ verticalAlign: "baseline", color: grey[700] }}
                    >
                      <RiDownload2Line size={16} />
                    </IconButton>
                  </Box>
                )}
              </ListItem>
            );
          })}
        </List>
      )}
    </React.Fragment>
  );
};

export const StateApiLogViewerPage = () => {
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get("nodeId");
  const fileName = searchParams.get("fileName");

  const backFolder = fileName
    ? [...fileName.split("/").slice(0, -1)].join("/")
    : undefined;
  const backHref =
    // backGlob is undefined when glob is empty
    // backGlob is empty string when glob is 1 level deep.
    backFolder !== undefined
      ? `/logs/?nodeId=${nodeId}&folder=${backFolder}`
      : `/logs/?nodeId=${nodeId}`;

  return (
    <Box sx={{ padding: 2, width: "100%" }}>
      <TitleCard title="Logs Viewer">
        <Paper elevation={0}>
          {!nodeId && <p>Select a node to view logs</p>}
          {nodeId && (
            <React.Fragment>
              <p>Node: {nodeId}</p>
              <p>File: {decodeURIComponent(fileName || "")}</p>
            </React.Fragment>
          )}
          {nodeId && (
            <Box
              sx={{
                margin: 1,
              }}
            >
              <Button component={RouterLink} variant="contained" to={backHref}>
                Back To ../
              </Button>
            </Box>
          )}
        </Paper>
        <Paper elevation={0}>
          {nodeId && fileName ? (
            <StateApiLogViewer
              data={{
                nodeId,
                filename: fileName,
              }}
              height={600}
            />
          ) : (
            <Typography color="error">Invalid url parameters</Typography>
          )}
        </Paper>
      </TitleCard>
    </Box>
  );
};

/**
 * Logs page for the new information architecture
 */
export const LogsLayout = () => {
  return (
    <React.Fragment>
      <MainNavPageInfo
        pageInfo={{ title: "Logs", id: "logs", path: "/logs" }}
      />
      <Outlet />
    </React.Fragment>
  );
};
