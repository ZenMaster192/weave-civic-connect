import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MOCK_ISSUES } from "@/lib/mockData";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useState } from "react";
import { CheckCircle2, Upload, Star } from "lucide-react";
import { toast } from "sonner";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function Discover() {
  const [selected, setSelected] = useState(MOCK_ISSUES[0]);
  const [resolving, setResolving] = useState(false);
  const [rating, setRating] = useState(5);

  const resolve = () => {
    toast.success("Issue marked resolved · ISSUE_RESOLVED event fired · +50 XP");
    setResolving(false);
  };

  return (
    <AppShell role="volunteer">
      <h1 className="font-display text-4xl mb-2">Discover</h1>
      <p className="text-muted-foreground mb-6">Map of nearby issues matched to your skills.</p>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <Card className="overflow-hidden soft-card border-0 h-[600px]">
          <MapContainer center={[18.52, 73.86]} zoom={12} className="h-full w-full">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {MOCK_ISSUES.map(i => (
              <Marker key={i.id} position={[i.lat, i.lng]} eventHandlers={{ click: () => setSelected(i) }}>
                <Popup>
                  <b>{i.title}</b><br />{i.category}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden soft-card border-0">
            <img src={selected.beforeImage} alt="" className="w-full h-48 object-cover" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display text-xl">{selected.title}</h3>
                <Badge variant="secondary">{selected.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">📍 {selected.location}</p>
              <p className="text-sm text-muted-foreground mb-4">{selected.description}</p>

              <div className="flex flex-wrap gap-1 mb-4">
                {selected.keywords.map(k => <Badge key={k} variant="outline" className="text-xs">#{k}</Badge>)}
              </div>

              {!resolving ? (
                <Button className="w-full gap-2" onClick={() => setResolving(true)}>
                  <CheckCircle2 className="w-4 h-4" /> Begin resolution
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-border rounded-xl p-5 text-center text-sm text-muted-foreground hover:bg-muted/40 transition-smooth cursor-pointer">
                    <Upload className="w-5 h-5 mx-auto mb-1" />
                    Upload after photo
                  </div>
                  <Textarea placeholder="Resolution notes..." rows={2} />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Rate the citizen</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setRating(n)}>
                          <Star className={`w-5 h-5 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" onClick={resolve}>Mark as resolved</Button>
                  <Button className="w-full" variant="ghost" onClick={() => setResolving(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
