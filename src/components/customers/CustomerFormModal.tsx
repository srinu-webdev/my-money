"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useModal } from "@/components/providers/ModalProvider";
import { ModalHeader, ModalBody, ModalFooter, FormError } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormGroup, Input, Select, Textarea } from "@/components/ui/Field";
import { createCustomerAction, updateCustomerAction } from "@/lib/actions/customers";
import type { Customer } from "@/lib/types";
import { Edit, Plus } from "@/components/ui/icons";

export function CustomerFormModal({ customer, onSaved }: { customer?: Customer; onSaved?: (id: string) => void }) {
  const { closeModal } = useModal();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = !!customer;

  function submit(formData: FormData) {
    setError(null);
    const payload = {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      address: String(formData.get("address") || ""),
      city: String(formData.get("city") || ""),
      state: String(formData.get("state") || ""),
      postalCode: String(formData.get("postalCode") || ""),
      notes: String(formData.get("notes") || ""),
      status: String(formData.get("status") || "ACTIVE") as "ACTIVE" | "INACTIVE",
    };
    startTransition(async () => {
      if (editing) {
        const res = await updateCustomerAction(customer.id, payload);
        if (!res.ok) return setError(res.error);
        toast.success("Customer updated successfully");
        closeModal();
        router.refresh();
      } else {
        const res = await createCustomerAction(payload);
        if (!res.ok) return setError(res.error);
        toast.success("Customer added successfully");
        closeModal();
        router.refresh();
        onSaved?.(res.data.id);
      }
    });
  }

  return (
    <form action={submit}>
      <ModalHeader title={editing ? "Edit Customer" : "Add Customer"} sub={editing ? customer.id : "Register a new borrower"} onClose={closeModal} />
      <ModalBody>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormGroup label="Full Name" required className="sm:col-span-2">
            <Input name="name" defaultValue={customer?.name} placeholder="e.g. Ravi Kumar" required />
          </FormGroup>
          <FormGroup label="Phone" required>
            <Input name="phone" defaultValue={customer?.phone ?? "+91 "} placeholder="+91 98765 43210" />
          </FormGroup>
          <FormGroup label="Email">
            <Input type="email" name="email" defaultValue={customer?.email ?? ""} placeholder="name@example.com" />
          </FormGroup>
          <FormGroup label="Address" className="sm:col-span-2">
            <Input name="address" defaultValue={customer?.address ?? ""} placeholder="Street / locality" />
          </FormGroup>
          <FormGroup label="City">
            <Input name="city" defaultValue={customer?.city ?? ""} />
          </FormGroup>
          <FormGroup label="State">
            <Input name="state" defaultValue={customer?.state ?? ""} />
          </FormGroup>
          <FormGroup label="Postal Code">
            <Input name="postalCode" defaultValue={customer?.postalCode ?? ""} />
          </FormGroup>
          <FormGroup label="Status">
            <Select name="status" defaultValue={customer?.status ?? "ACTIVE"}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FormGroup>
          <FormGroup label="Notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={customer?.notes ?? ""} placeholder="Internal notes about this customer" />
          </FormGroup>
        </div>
        <FormError message={error} />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? "Update Customer" : "Save Customer"}
        </Button>
      </ModalFooter>
    </form>
  );
}

export function useAddCustomerModal() {
  const { openModal } = useModal();
  return (onSaved?: (id: string) => void) => openModal(<CustomerFormModal onSaved={onSaved} />, { size: "lg" });
}

export function useEditCustomerModal() {
  const { openModal } = useModal();
  return (customer: Customer) => openModal(<CustomerFormModal customer={customer} />, { size: "lg" });
}

export function AddCustomerButton({ label = "Add Customer" }: { label?: string }) {
  const open = useAddCustomerModal();
  return (
    <Button onClick={() => open()}>
      <Plus /> {label}
    </Button>
  );
}

export function EditCustomerButton({ customer, label = "Edit Customer" }: { customer: Customer; label?: string }) {
  const open = useEditCustomerModal();
  return (
    <Button variant="secondary" onClick={() => open(customer)}>
      <Edit /> {label}
    </Button>
  );
}
