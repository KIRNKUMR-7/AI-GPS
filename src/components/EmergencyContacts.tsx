import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Phone, X, Users } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

const defaultContacts: Contact[] = [
  { id: "1", name: "Mom", phone: "+91 98765 43210", relation: "Mother" },
  { id: "2", name: "Priya", phone: "+91 87654 32109", relation: "Friend" },
  { id: "3", name: "Local Police", phone: "100", relation: "Authority" },
];

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState<Contact[]>(defaultContacts);
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", relation: "" });

  const addContact = () => {
    if (newContact.name && newContact.phone) {
      setContacts([...contacts, { ...newContact, id: Date.now().toString() }]);
      setNewContact({ name: "", phone: "", relation: "" });
      setAdding(false);
    }
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id));
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Emergency Contacts
          </h3>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden"
          >
            <input
              placeholder="Name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              placeholder="Phone"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              placeholder="Relation"
              value={newContact.relation}
              onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={addContact}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              Add Contact
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {contacts.map((contact) => (
          <motion.div
            key={contact.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{contact.name[0]}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{contact.relation} · {contact.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a href={`tel:${contact.phone}`} className="p-1.5 rounded-lg hover:bg-safe/10 text-safe transition">
                <Phone className="w-4 h-4" />
              </a>
              <button onClick={() => removeContact(contact.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger opacity-0 group-hover:opacity-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EmergencyContacts;
