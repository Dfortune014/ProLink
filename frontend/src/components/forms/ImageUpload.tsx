import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Loader2 } from "lucide-react";
import { uploadApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (data: { url: string; key: string }) => void;
  label?: string;
  getInitials?: () => string;
  uploadType?: "profile_image" | "project_image" | "resume";
  variant?: "avatar" | "rectangle"; // New prop to control shape
}

const ImageUpload = ({ 
  currentImageUrl, 
  onImageUploaded, 
  label = "Profile Image",
  getInitials,
  uploadType = "profile_image",
  variant = "avatar"
}: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Show preview
    setImageError(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploading(true);
    try {
      // Get presigned URL - pass the exact file type
      console.log("DEBUG: Requesting presigned URL", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
      
      const response = await uploadApi.getUploadUrl(
        file.name,
        file.type,
        uploadType
      );

      console.log("DEBUG: Received presigned URL response", {
        hasUploadUrl: !!response.upload_url || !!response.uploadUrl,
        hasKey: !!response.key,
        hasPublicUrl: !!response.url,
        contentType: response.content_type,
        key: response.key
      });

      // Handle both snake_case and camelCase response formats
      const uploadUrl = response.upload_url || response.uploadUrl;
      const publicUrl = response.url;
      // Use the exact Content-Type that Lambda signed in the presigned URL
      const signedContentType = response.content_type || file.type;

      if (!uploadUrl) {
        throw new Error("No upload URL received from server");
      }

      // Upload to S3
      // Since ContentType is not in the presigned URL signature, we can set it naturally
      // Use the file's native type or the suggested type from Lambda
      console.log("DEBUG: Uploading to S3", {
        uploadUrl: uploadUrl.substring(0, 100) + "...", // Log partial URL to avoid exposing full credentials
        contentType: signedContentType || file.type,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          // Set Content-Type - since it's not in the signature, any valid type should work
          "Content-Type": signedContentType || file.type,
        },
        // Don't send credentials - presigned URLs are self-contained
        credentials: "omit",
      });

      console.log("DEBUG: S3 Upload Response", {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        ok: uploadResponse.ok,
        headers: Object.fromEntries(uploadResponse.headers.entries())
      });

      if (!uploadResponse.ok) {
        // Try to get error details from response body
        let errorBody = "";
        try {
          errorBody = await uploadResponse.text();
          console.error("DEBUG: S3 Error Response Body:", errorBody);
        } catch (e) {
          console.error("DEBUG: Could not read error response body:", e);
        }
        
        throw new Error(`Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}${errorBody ? ` - ${errorBody}` : ""}`);
      }

      // Call callback with both URL and key for storage in DynamoDB
      console.log("DEBUG: Calling onImageUploaded with:", {
        url: publicUrl,
        key: response.key
      });
      
      onImageUploaded({
        url: publicUrl,
        key: response.key
      });
      
      // Clear preview so the actual S3 URL is displayed
      setPreview(null);
      setImageError(false);
      
      toast({
        title: "Image uploaded",
        description: "Your profile image has been updated.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageUploaded({ url: "", key: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayImage = preview || currentImageUrl;

  if (variant === "rectangle") {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden border-2 border-border">
              {displayImage && !imageError ? (
                <img
                  src={displayImage}
                  alt={label}
                  className="w-full h-full object-cover"
                  onError={() => {
                    console.error("Failed to load image:", displayImage);
                    setImageError(true);
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {imageError ? "Image failed to load" : "No image"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {displayImage ? "Change Image" : "Upload Image"}
                </>
              )}
            </Button>
            {displayImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG or GIF. Max size 5MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage 
            src={displayImage && !imageError ? displayImage : undefined} 
            alt="Profile"
            onError={() => {
              console.error("Failed to load avatar image:", displayImage);
              setImageError(true);
            }}
          />
          <AvatarFallback className="bg-primary/10 text-primary text-lg">
            {getInitials ? getInitials() : "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {displayImage ? "Change" : "Upload"}
                </>
              )}
            </Button>
            {displayImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG or GIF. Max size 5MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default ImageUpload;

