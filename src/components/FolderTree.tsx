"use client";

import { useEffect, useState } from "react";
import { useFileStore } from "@/store/useFileStore";
import { FolderIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface TreeNode {
  _id: string;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  children: TreeNode[];
}

export default function FolderTree() {
  const router = useRouter();
  const { allFolders, currentFolderId, fetchAllFolders } = useFileStore();
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAllFolders();
  }, [fetchAllFolders]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Build recursive tree from flat folders list
  const buildTree = (folders: any[], parentId: string | null = null): TreeNode[] => {
    return folders
      .filter((f) => {
        const fParentId = f.parentId ? f.parentId.toString() : null;
        const targetParentId = parentId ? parentId.toString() : null;
        return fParentId === targetParentId;
      })
      .map((f) => ({
        _id: f._id.toString(),
        name: f.name,
        parentId: f.parentId ? f.parentId.toString() : null,
        color: f.color || "#0ea5e9",
        icon: f.icon || "folder",
        children: buildTree(folders, f._id)
      }));
  };

  const folderTree = buildTree(allFolders);

  const renderNode = (node: TreeNode, level = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = !!expandedFolders[node._id];
    const isSelected = currentFolderId === node._id;

    return (
      <div key={node._id} className="select-none">
        <div
          onClick={() => router.push(`/dashboard/files?folder=${node._id}`)}
          className={cn(
            "flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150 group font-mono text-xs mb-0.5",
            isSelected
              ? "bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-white font-semibold shadow-[0_0_10px_rgba(139,92,246,0.15)]"
              : "text-gray-400 hover:bg-white/5 hover:text-white"
          )}
          style={{ paddingLeft: `${Math.max(8, level * 12)}px` }}
        >
          <span
            onClick={(e) => hasChildren && toggleExpand(node._id, e)}
            className={cn(
              "p-0.5 rounded hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer",
              !hasChildren && "opacity-0 pointer-events-none w-4 h-4"
            )}
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-3 h-3 text-gray-500 group-hover:text-white" />
            ) : (
              <ChevronRightIcon className="w-3 h-3 text-gray-500 group-hover:text-white" />
            )}
          </span>

          <FolderIcon
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{
              color: node.color,
              filter: `drop-shadow(0 0 3px ${node.color}44)`
            }}
          />

          <span className="truncate flex-1">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div className="relative ml-2 pl-2">
            {/* Visual tree guide line */}
            <div className="absolute left-1 top-0 bottom-1 w-px bg-white/5" />
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
      {folderTree.length === 0 ? (
        <div className="text-[10px] text-gray-600 font-mono italic px-2">
          NO SECTOR DIRECTORIES
        </div>
      ) : (
        folderTree.map((node) => renderNode(node))
      )}
    </div>
  );
}
